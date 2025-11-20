const fs = require('fs').promises;
const path = require('path');

const DATA_FILE = path.join('/tmp', 'users-data.json');

// Initialiser le fichier s'il n'existe pas
async function ensureDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch {
        await fs.writeFile(DATA_FILE, JSON.stringify({ users: {} }));
    }
}

// Lire les données
async function readData() {
    await ensureDataFile();
    const content = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(content);
}

// Écrire les données
async function writeData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

exports.handler = async (event) => {
    // Configuration CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Gérer les requêtes OPTIONS (preflight)
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const data = await readData();

        // GET : Récupérer toutes les données
        if (event.httpMethod === 'GET') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(data)
            };
        }

        // POST : Sauvegarder les données d'un utilisateur
        if (event.httpMethod === 'POST') {
            const { username, data: userData } = JSON.parse(event.body);

            if (!username || !userData) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Username et data requis' 
                    })
                };
            }

            // Validation de la structure des données
            if (userData.exercises && !Array.isArray(userData.exercises)) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'exercises doit être un tableau' 
                    })
                };
            }

            if (userData.targets && typeof userData.targets !== 'object') {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'targets doit être un objet' 
                    })
                };
            }

            // Sauvegarder les données utilisateur
            data.users = data.users || {};
            data.users[username] = {
                ...userData,
                lastUpdate: new Date().toISOString()
            };

            await writeData(data);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true,
                    message: 'Données sauvegardées',
                    user: data.users[username]
                })
            };
        }

        // Méthode non supportée
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ 
                error: 'Méthode non autorisée' 
            })
        };

    } catch (error) {
        console.error('Erreur:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Erreur serveur',
                details: error.message 
            })
        };
    }
};
