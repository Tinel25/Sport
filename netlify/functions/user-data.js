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

// -------------------------
// UTIL : SAFE JSON PARSE
// -------------------------
function safeJson(body) {
    try {
        if (!body) return {};
        return JSON.parse(body);
    } catch (e) {
        console.error("❌ Invalid JSON received:", body);
        return {};
    }
}

// -------------------------
// GET FILE FROM GITHUB
// -------------------------
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
            const txt = await response.text();
            console.error('❌ GitHub error:', txt);
            throw new Error("GitHub API error");
        }

        const data = await response.json();
        const decoded = Buffer.from(data.content, 'base64').toString('utf8');
        let content = safeJson(decoded);

        if (!Array.isArray(content)) content = [];

        return { content, sha: data.sha };
    } catch (err) {
        console.error('❌ Failed to load GitHub file:', err);
        return { content: [], sha: null };
    }
}

// -------------------------
// SAVE FILE TO GITHUB
// -------------------------
async function saveFileToGitHub(content, sha) {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_FILE}`;

    const body = {
        message: "Update user data",
        content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
        branch: BRANCH,
        sha: sha || undefined
    };

    const response = await fetch(url, {
        method: "PUT",
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Netlify-Function'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const txt = await response.text();
        console.error("❌ GitHub save error:", txt);
        throw new Error("GitHub save failed");
    }

    return response.json();
}

// -------------------------
// MAIN HANDLER
// -------------------------
exports.handler = async (event) => {
    console.log("🚀 Function hit:", event.httpMethod);

    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    const body = safeJson(event.body);
    const username = body.username || event.queryStringParameters?.username;

    try {
        // -------------------------
        // GET LEADERBOARD
        // -------------------------
        if (event.httpMethod === "GET" && !username) {
            console.log("📊 Fetching leaderboard...");
            const { content } = await getFileFromGitHub();

            const leaderboard = content.map(u => {
                const totalScore = Object.values(u.targets || {}).reduce((a, b) => a + b, 0);
                const totalSuccess = u.history?.filter(h => h.success).length || 0;
                const successRate = u.totalDays > 0 ? Math.round((totalSuccess / u.totalDays) * 100) : 0;

                return {
                    username: u.username,
                    level: u.level,
                    exercises: u.exercises || [],
                    totalScore,
                    streak: u.streak || 0,
                    totalDays: u.totalDays || 0,
                    successRate,
                    targets: u.targets || {}
                };
            }).sort((a, b) => b.totalScore - a.totalScore);

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
                body: JSON.stringify({ error: "Username required" })
            };
        }

        // -------------------------
        // GET USER DATA
        // -------------------------
        if (event.httpMethod === "GET") {
            const { content } = await getFileFromGitHub();
            const user = content.find(u => u.username === username) || null;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(user)
            };
        }

        // -------------------------
        // SAVE USER DATA (CREATE OR UPDATE)
        // -------------------------
        if (event.httpMethod === "POST") {
            console.log("💾 Saving user:", username);

            const newUser = body;
            const { content, sha } = await getFileFromGitHub();

            const index = content.findIndex(u => u.username === username);

            if (index >= 0) {
                content[index] = newUser;
                console.log("✏️ User updated");
            } else {
                content.push(newUser);
                console.log("➕ User created");
            }

            await saveFileToGitHub(content, sha);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        }

        // -------------------------
        // DELETE USER
        // -------------------------
        if (event.httpMethod === "DELETE") {
            const { content, sha } = await getFileFromGitHub();
            const updated = content.filter(u => u.username !== username);

            await saveFileToGitHub(updated, sha);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: "Method not allowed" })
        };

    } catch (err) {
        console.error("❌ Handler crashed:", err);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Server error",
                details: err.message
            })
        };
    }
};
