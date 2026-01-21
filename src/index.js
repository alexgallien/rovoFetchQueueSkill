import api, { route } from '@forge/api';

/**
 * Extracts service desk and queue IDs from a JSM queue URL
 * Expected format: https://site.atlassian.net/jira/servicedesk/projects/PROJECT/queues/custom/123
 * @param {string} queueUrl - The full JSM queue URL
 * @returns {Object} Object containing serviceDeskId and queueId
 */
const parseQueueUrl = (queueUrl) => {
  try {
    const url = new URL(queueUrl);
    const pathParts = url.pathname.split('/');
    
    // Find the project key (after 'projects')
    const projectsIndex = pathParts.indexOf('projects');
    if (projectsIndex === -1 || projectsIndex + 1 >= pathParts.length) {
      throw new Error('Invalid queue URL format: cannot find project key');
    }
    const projectKey = pathParts[projectsIndex + 1];
    
    // Find the queue ID (after 'queues/custom' or 'queues')
    const queuesIndex = pathParts.indexOf('queues');
    if (queuesIndex === -1 || queuesIndex + 2 >= pathParts.length) {
      throw new Error('Invalid queue URL format: cannot find queue ID');
    }
    
    // Handle both 'queues/custom/123' and 'queues/123' formats
    let queueId;
    if (pathParts[queuesIndex + 1] === 'custom') {
      queueId = pathParts[queuesIndex + 2];
    } else {
      queueId = pathParts[queuesIndex + 1];
    }
    
    if (!queueId) {
      throw new Error('Invalid queue URL format: queue ID not found');
    }
    
    console.log(`Parsed queue URL - Project: ${projectKey}, Queue ID: ${queueId}`);
    return { serviceDeskId: projectKey, queueId: queueId };
  } catch (error) {
    console.error('Error parsing queue URL:', error);
    throw new Error(`Failed to parse queue URL: ${error.message}`);
  }
};

/**
 * Fetches the JQL filter from a Jira Service Management queue
 * Uses the JSM API: /rest/servicedeskapi/servicedesk/{serviceDeskId}/queue/{queueId}
 * @param {Object} payload - Contains queueUrl from the action input
 * @returns {Object} The queue data including JQL filter
 */
export async function fetchQueueJQL(payload) {
  try {
    const { queueUrl } = payload;
    
    if (!queueUrl) {
      throw new Error('Queue URL is required');
    }
    
    console.log(`Fetching JQL for queue URL: ${queueUrl}`);
    
    // Parse the queue URL to extract service desk and queue IDs
    const { serviceDeskId, queueId } = parseQueueUrl(queueUrl);
    
    // Call the JSM API to get queue details
    const response = await api.asUser().requestJira(
      route`/rest/servicedeskapi/servicedesk/${serviceDeskId}/queue/${queueId}`, 
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`JSM API request failed: ${response.status} - ${errorText}`);
      throw new Error(`Failed to fetch queue data: ${response.status} ${response.statusText}`);
    }
    
    const queueData = await response.json();
    console.log('Successfully fetched queue data:', JSON.stringify(queueData, null, 2));
    
    // Extract and return the JQL along with other useful queue information
    return {
      success: true,
      queueName: queueData.name,
      jql: queueData.jql,
      serviceDeskId: serviceDeskId,
      queueId: queueId,
      issueTypes: queueData.issueTypes || [],
      columns: queueData.columns || []
    };
    
  } catch (error) {
    console.error('Error in fetchQueueJQL:', error);
    return {
      success: false,
      error: error.message,
      details: 'Make sure the queue URL is valid and you have access to the service desk project'
    };
  }
}
