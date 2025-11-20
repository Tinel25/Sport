const fetch = require('node-fetch');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = 'Tinel25';
const GITHUB_REPO = 'Sport';
const DATA_FILE = 'data/users.json';
const BRANCH = 'main';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
};

const defaultUserData = {
    exercises: [],
    level: null,
    targets: {},
    exerciseStats: {},
    streak: 0,
    totalDays: 0,
    lastCheckDate: null,
    history: []
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
            return { content: {}, sha: null };
        }

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();
        const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
        
        return { content, sha: data.sha };
    } catch (error) {
        console.error('Error fetching from GitHub:', error);
        return { content: {}, sha: null };
    }
}

async function saveFileToGitHub(content, sha) {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_FILE}`;
    
    const body = {
        message: 'Update user data',
        content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
        branch: BRANCH
    };

    if (sha) {
        body.sha = sha;
    }

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Netlify-Function'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }

    return await response.json();
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const username = event.queryStringParameters?.username;

        if (!username) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Username required' })
            };
        }

        // GET - Récupérer les données d'un utilisateur
        if (event.httpMethod === 'GET') {
            const { content } = await getFileFromGitHub();
            const userData = content[username] || null;
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(userData)
            };
        }

        // POST - Sauvegarder les données d'un utilisateur
        if (event.httpMethod === 'POST') {
            const userData = JSON.parse(event.body);
            const { content, sha } = await getFileFromGitHub();
            
            content[username] = userData;
            await saveFileToGitHub(content, sha);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        }

        // DELETE - Supprimer un utilisateur
        if (event.httpMethod === 'DELETE') {
            const { content, sha } = await getFileFromGitHub();
            
            if (content[username]) {
                delete content[username];
                await saveFileToGitHub(content, sha);
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
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
