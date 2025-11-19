// netlify/functions/user-data.js

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const FILE_PATH = 'data/users.json';

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;

  try {
    // GET : Récupérer les données
    if (event.httpMethod === 'GET') {
      const https = require('https');
      
      const response = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.github.com',
          path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`,
          method: 'GET',
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Netlify-Function'
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        
        req.on('error', reject);
        req.end();
      });

      if (response.status === 404) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ users: {} })
        };
      }

      const fileData = JSON.parse(response.data);
      const content = JSON.parse(Buffer.from(fileData.content, 'base64').toString());
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(content)
      };
    }

    // POST : Sauvegarder les données
    if (event.httpMethod === 'POST') {
      const https = require('https');
      const userData = JSON.parse(event.body);

      // Récupérer le SHA du fichier existant
      let sha = null;
      let existingData = { users: {} };

      const getResponse = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.github.com',
          path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`,
          method: 'GET',
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Netlify-Function'
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        
        req.on('error', reject);
        req.end();
      });

      if (getResponse.status === 200) {
        const fileData = JSON.parse(getResponse.data);
        sha = fileData.sha;
        existingData = JSON.parse(Buffer.from(fileData.content, 'base64').toString());
      }

      // Fusionner les données
      existingData.users[userData.username] = userData.data;

      // Encoder en base64
      const contentBase64 = Buffer.from(JSON.stringify(existingData, null, 2)).toString('base64');

      // Créer ou mettre à jour le fichier
      const putResponse = await new Promise((resolve, reject) => {
        const postData = JSON.stringify({
          message: `Update data for ${userData.username}`,
          content: contentBase64,
          sha: sha
        });

        const options = {
          hostname: 'api.github.com',
          path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`,
          method: 'PUT',
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'User-Agent': 'Netlify-Function'
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
      });

      if (putResponse.status !== 200 && putResponse.status !== 201) {
        throw new Error(`GitHub API error: ${putResponse.data}`);
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
      body: JSON.stringify({ error: error.message })
    };
  }
};
