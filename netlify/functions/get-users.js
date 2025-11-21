const fetch = require('node-fetch');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = 'Tinel25';
const GITHUB_REPO = 'Sport';
const DATA_FILE = 'data/users.json';
const BRANCH = 'main';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
};

async function getFileFromGitHub() {
    try {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_FILE}?ref=${BRANCH}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Netlify-Function'
            }
        });

        if (response.status === 404) {
            return {};
        }

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();
        const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
        
        return content;
    } catch (error) {
        console.error('Error fetching from GitHub:', error);
        return {};
    }
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        if (event.httpMethod === 'GET') {
            const allUsersData = await getFileFromGitHub();
            
            // Transformer l'objet en tableau avec username
            const usersArray = Object.entries(allUsersData).map(([username, data]) => ({
                username,
                ...data
            }));

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(usersArray)
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Handler error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Server error',
                details: error.message
            })
        };
    }
};
