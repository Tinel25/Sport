const fetch = require('node-fetch');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = 'Tinel25/Sport'; // Ton repo
const DATA_FILE = 'data/users.json'; // Chemin du fichier dans le repo
const BRANCH = 'main'; // ou 'master'

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
};

// Fonction pour récupérer le fichier depuis GitHub
async function getFileFromGitHub() {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`;
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Netlify-Function'
        }
    });

    if (response.status === 404) {
        return null; // Fichier n'existe pas encore
    }

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    
    return {
        content: JSON.parse(content),
        sha: data.sha // Nécessaire pour les updates
    };
}

// Fonction pour sauvegarder sur GitHub
async function saveFileToGitHub(content, sha = null) {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`;
    
    const body = {
        message: `Update fitness data - ${new Date().toISOString()}`,
        content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
        branch: BRANCH
    };

    if (sha) {
        body.sha = sha; // Nécessaire pour update
    }

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Netlify-Function'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`GitHub save error: ${JSON.stringify(error)}`);
    }

    return await response.json();
}

exports.handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // GET - Récupérer les données
        if (event.httpMethod === 'GET') {
            const fileData = await getFileFromGitHub();
            
            if (!fileData) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'No data found' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(fileData.content)
            };
        }

        // POST - Sauvegarder les données
        if (event.httpMethod === 'POST') {
            const userData = JSON.parse(event.body);
            
            // Récupère le SHA actuel du fichier (nécessaire pour l'update)
            const currentFile = await getFileFromGitHub();
            const sha = currentFile ? currentFile.sha : null;

            await saveFileToGitHub(userData, sha);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        }

        // DELETE - Supprimer les données
        if (event.httpMethod === 'DELETE') {
            const currentFile = await getFileFromGitHub();
            
            if (currentFile) {
                const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`;
                
                await fetch(url, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'Netlify-Function'
                    },
                    body: JSON.stringify({
                        message: 'Delete fitness data',
                        sha: currentFile.sha,
                        branch: BRANCH
                    })
                });
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
        console.error('Error:', error);
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
