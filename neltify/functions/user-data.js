const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER; // Votre username GitHub
const GITHUB_REPO = process.env.GITHUB_REPO;   // Nom du repo
const FILE_PATH = 'data/users.json';

exports.handler = async (event, context) => {
  // Configuration CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Gérer les requêtes OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;

  try {
    // GET : Récupérer les données
    if (event.httpMethod === 'GET') {
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Netlify-Function'
        }
      });

      if (response.status === 404) {
        // Le fichier n'existe pas encore, retourner un objet vide
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ users: {} })
        };
      }

      const data = await response.json();
      const content = JSON.parse(Buffer.from(data.content, 'base64').toString());
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(content)
      };
    }

    // POST : Sauvegarder les données
    if (event.httpMethod === 'POST') {
      const userData = JSON.parse(event.body);

      // Récupérer le SHA du fichier existant (nécessaire pour la mise à jour)
      let sha = null;
      let existingData = { users: {} };

      const getResponse = await fetch(apiUrl, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Netlify-Function'
        }
      });

      if (getResponse.ok) {
        const fileData = await getResponse.json();
        sha = fileData.sha;
        existingData = JSON.parse(Buffer.from(fileData.content, 'base64').toString());
      }

      // Fusionner les données
      existingData.users[userData.username] = userData.data;

      // Encoder en base64
      const contentBase64 = Buffer.from(JSON.stringify(existingData, null, 2)).toString('base64');

      // Créer ou mettre à jour le fichier
      const putResponse = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Netlify-Function'
        },
        body: JSON.stringify({
          message: `Update data for ${userData.username}`,
          content: contentBase64,
          sha: sha
        })
      });

      if (!putResponse.ok) {
        const error = await putResponse.text();
        throw new Error(`GitHub API error: ${error}`);
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

