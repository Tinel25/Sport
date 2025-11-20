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

async function getFileFromGitHub() {
    try {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_FILE}?ref=${BRANCH}`;
        console.log('📡 Fetching from GitHub:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Netlify-Function'
            }
        });

        if (response.status === 404) {
            console.log('⚠️ File not found, returning empty array');
            return { content: [], sha: null };
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ GitHub API error:', response.status, errorText);
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();
        const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
        
        console.log('✅ Data loaded from GitHub:', content);

        // S'assurer que c'est un array
        if (!Array.isArray(content)) {
            console.warn('⚠️ Content is not an array, converting...');
            return { content: [], sha: data.sha };
        }

        return { content, sha: data.sha };
    } catch (error) {
        console.error('❌ Error fetching from GitHub:', error);
        return { content: [], sha: null };
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

    console.log('💾 Saving to GitHub...');

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
        console.error('❌ Save error:', error);
        throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }

    console.log('✅ Saved successfully');
    return await response.json();
}

exports.handler = async (event) => {
    console.log('🚀 Function called:', event.httpMethod);
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const username = event.queryStringParameters?.username;

        // GET sans username = récupérer le leaderboard
        if (event.httpMethod === 'GET' && !username) {
            console.log('📊 Loading leaderboard...');
            const { content } = await getFileFromGitHub();

            // Calculer le leaderboard à partir de l'array
            const leaderboard = content.map(user => {
                const totalScore = Object.values(user.targets || {}).reduce((sum, val) => sum + val, 0);
                const successRate = user.totalDays > 0 
                    ? Math.round(((user.history?.filter(h => h.success).length || 0) / user.totalDays) * 100)
                    : 0;

                return {
                    username: user.username,
                    level: user.level,
                    totalScore,
                    streak: user.streak || 0,
                    totalDays: user.totalDays || 0,
                    successRate,
                    targets: user.targets || {},
                    exercises: user.exercises || []
                };
            }).sort((a, b) => b.totalScore - a.totalScore);

            console.log('✅ Leaderboard generated:', leaderboard.length, 'users');

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(leaderboard)
            };
        }

        if (!username) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Username required' })
            };
        }

        // GET - Récupérer les données d'un utilisateur
        if (event.httpMethod === 'GET') {
            console.log('👤 Getting user:', username);
            const { content } = await getFileFromGitHub();
            const userData = content.find(u => u.username === username) || null;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(userData)
            };
        }

        // POST - Sauvegarder les données d'un utilisateur
        if (event.httpMethod === 'POST') {
            console.log('💾 Saving user:', username);
            const userData = JSON.parse(event.body);
            const { content, sha } = await getFileFromGitHub();

            const existingIndex = content.findIndex(u => u.username === username);
            
            if (existingIndex >= 0) {
                content[existingIndex] = userData;
                console.log('✏️ User updated');
            } else {
                content.push(userData);
                console.log('➕ New user added');
            }

            await saveFileToGitHub(content, sha);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        }

        // DELETE - Supprimer un utilisateur
        if (event.httpMethod === 'DELETE') {
            console.log('🗑️ Deleting user:', username);
            const { content, sha } = await getFileFromGitHub();
            const newContent = content.filter(u => u.username !== username);

            if (newContent.length < content.length) {
                await saveFileToGitHub(newContent, sha);
                console.log('✅ User deleted');
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
        console.error('❌ Handler error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Server error',
                details: error.message,
                stack: error.stack
            })
        };
    }
};
