const express = require('express');
const bodyParser = require('body-parser');
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Organization to MSP mapping
const orgToMSPMap = {
    'org1': 'Org1MSP',
    'org2': 'Org2MSP',
};

// Load network connection profile dynamically based on organization
async function getConnectionProfile(orgName) {
    const ccpPath = path.resolve(__dirname, '..', '..', '..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', `${orgName}.example.com`, `connection-${orgName}.json`);
    return JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
}

// Set up wallet and gateway for dynamic user and organization
async function getContract(orgName, userName) {
    const msp = orgToMSPMap[orgName];
    if (!msp) {
        throw new Error(`No MSP found for organization ${orgName}`);
    }

    const walletPath = path.join(__dirname, 'wallet', orgName);
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    const identity = await wallet.get(userName);
    if (!identity) {
        throw new Error(`Identity not found for user ${userName} in ${orgName}. Register the user before proceeding.`);
    }

    const ccp = await getConnectionProfile(orgName);
    const gateway = new Gateway();
    await gateway.connect(ccp, {
        wallet,
        identity: userName,
        discovery: { enabled: true, asLocalhost: true }
    });

    const network = await gateway.getNetwork('mychannel');
    return network.getContract('basic'); // Replace 'basic' with the name of your chaincode
}

// Create Asset
app.post('/asset', async (req, res) => {
    try {
        const { orgName, userName, assetID, color, size, owner, appraisedValue } = req.body;
        if (!orgName || !userName || !assetID || !color || !size || !owner || !appraisedValue) {
            return res.status(400).send('Missing required fields');
        }
        const contract = await getContract(orgName, userName);
        await contract.submitTransaction('CreateAsset', assetID, color, size, owner, appraisedValue);
        res.send(`Asset ${assetID} created successfully!`);
    } catch (error) {
        console.error(error);
        res.status(500).send(error.toString());
    }
});

// Update Asset
app.put('/asset/:id', async (req, res) => {
    try {
        const { orgName, userName, color, size, owner, appraisedValue } = req.body;
        if (!orgName || !userName || !color || !size || !owner || !appraisedValue) {
            return res.status(400).send('Missing required fields');
        }
        const contract = await getContract(orgName, userName);
        await contract.submitTransaction('UpdateAsset', req.params.id, color, size, owner, appraisedValue);
        res.send(`Asset ${req.params.id} updated successfully!`);
    } catch (error) {
        console.error(error);
        res.status(500).send(error.toString());
    }
});

// Transfer Asset
app.post('/asset/:id/transfer', async (req, res) => {
    try {
        const { orgName, userName, newOwner } = req.body;
        if (!orgName || !userName || !newOwner) {
            return res.status(400).send('Missing required fields');
        }
        const contract = await getContract(orgName, userName);
        await contract.submitTransaction('TransferAsset', req.params.id, newOwner);
        res.send(`Asset ${req.params.id} transferred to ${newOwner} successfully!`);
    } catch (error) {
        console.error(error);
        res.status(500).send(error.toString());
    }
});

// Get Asset History
app.get('/asset/:id/history', async (req, res) => {
    try {
        const { orgName, userName } = req.query;
        if (!orgName || !userName) {
            return res.status(400).send('Missing required query parameters');
        }
        const contract = await getContract(orgName, userName);
        const result = await contract.evaluateTransaction('GetAssetHistory', req.params.id);
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        console.error(error);
        res.status(500).send(error.toString());
    }
});

// Delete Asset
app.delete('/asset/:id', async (req, res) => {
    try {
        const { orgName, userName } = req.body;
        if (!orgName || !userName) {
            return res.status(400).send('Missing required fields');
        }
        const contract = await getContract(orgName, userName);
        await contract.submitTransaction('DeleteAsset', req.params.id);
        res.send(`Asset ${req.params.id} deleted successfully!`);
    } catch (error) {
        console.error(error);
        res.status(500).send(error.toString());
    }
});

// Query Asset
app.get('/asset/:id', async (req, res) => {
    try {
        const { orgName, userName } = req.query;
        if (!orgName || !userName) {
            return res.status(400).send('Missing required query parameters');
        }
        const contract = await getContract(orgName, userName);
        const result = await contract.evaluateTransaction('ReadAsset', req.params.id);
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        console.error(error);
        res.status(500).send(error.toString());
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
