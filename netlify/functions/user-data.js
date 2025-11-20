const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
    const store = getStore('fitness-data');
    const userId = 'default-user'; // Pour l'instant, un seul utilisateur

    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle OPTIONS (preflight)
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // GET - Récupérer les données
        if (event.httpMethod === 'GET') {
            const data = await store.get(userId, { type: 'json' });
            
            if (!data) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'No data found' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(data)
            };
        }

        // POST - Sauvegarder les données
        if (event.httpMethod === 'POST') {
            const userData = JSON.parse(event.body);
            
            await store.set(userId, JSON.stringify(userData));

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        }

        // DELETE - Réinitialiser
        if (event.httpMethod === 'DELETE') {
            await store.delete(userId);

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
