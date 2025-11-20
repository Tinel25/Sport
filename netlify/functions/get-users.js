const fs = require('fs').promises;
const path = require('path');

const DATA_FILE = path.join('/tmp', 'users-data.json');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    try {
        const content = await fs.readFile(DATA_FILE, 'utf-8');
        const data = JSON.parse(content);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };
    } catch (error) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ users: {} })
        };
    }
};

