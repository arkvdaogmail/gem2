// app.js - VeChain Document Stamper (LIVE TESTNET) - FIXED LOGGER
console.log("🚀 Starting VeChain Document Stamper - LIVE TESTNET MODE");

const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env file

// VeChain SDK Imports
const { 
    ThorClient 
} = require('@vechain/sdk-network');
const { 
    Transaction, 
    Address, 
    Hex, 
    ABI, 
    Clause, 
    Sha256 
} = require('@vechain/sdk-core');

// ✅ FIXED LOGGER SETUP - Ensures .error(), .warn(), .info(), .log() methods exist
// This object replaces any problematic logger instance.
const logger = {
    info: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
    log: (...args) => console.log(...args),
};

// Configuration - Ensure these are set in your .env file
const PORT = process.env.PORT || 3001;
const NODE_URL = process.env.NODE_URL || 'https://testnet.vechain.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY; // Your private key (e.g., '0x...')
const VECHAIN_CONTRACT = process.env.VECHAIN_CONTRACT; // Your deployed contract address (e.g., '0x...')

// --- Strict Validation of Environment Variables ---
if (!PRIVATE_KEY) {
    logger.error('❌ CRITICAL: PRIVATE_KEY environment variable is missing.');
    logger.error('💡 Ensure it is set in your .env file or as an OS environment variable.');
    process.exit(1);
}
if (!VECHAIN_CONTRACT || VECHAIN_CONTRACT === '0x0000000000000000000000000000000000000000') {
    logger.warn('⚠️ WARNING: VECHAIN_CONTRACT address is missing or default.');
    logger.warn('    Using a placeholder, but you MUST replace it with your deployed contract address for real stamping.');
}

// Global SDK instances
let thorClient;
let signerAddress;

// Express app setup
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files (create a public folder if needed)

// Serve the main HTML file (create an index.html in 'public' if needed)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Initialize VeChain SDK and Wallet ---
async function initializeVeChainSDK() {
    try {
        logger.log('🔧 Initializing VeChain SDK', `Connecting to node: ${NODE_URL}`);
        
        // 1. Initialize ThorClient to connect to the VeChain node
        thorClient = ThorClient.at(NODE_URL);
        
        // 2. Derive wallet address from the private key (for signing and gas estimation)
        const privateKeyBytes = Hex.of(PRIVATE_KEY).bytes;
        signerAddress = Address.ofPrivateKey(privateKeyBytes).toString();
        
        // 3. Perform a quick test to verify node connection
        const bestBlock = await thorClient.blocks.getBestBlockCompressed();
        
        logger.info( 
            '✅ VeChain SDK Initialized Successfully', 
            `Signer Address: ${signerAddress}`,
            `Latest Block: ${bestBlock.number}`,
            `ChainTag (Testnet): 0x27` // Common Testnet ChainTag
        );

        // 4. Check VTHO balance (crucial for live transactions)
        const account = await thorClient.accounts.getAccount(signerAddress);
        if (account.energy < 1000000) { // Example threshold, adjust as needed
            logger.warn( 
                '⚠️ Low VTHO Balance', 
                `Current VTHO: ${account.energy} (approx ${Number(account.energy)/1e18} VTHO)`,
                `Consider getting more test VTHO from: https://faucet.vecha.in/`
            );
        }
        
        return true;
        
    } catch (error) {
        logger.error( 
            '❌ VeChain SDK Initialization Failed', 
            error.message,
            'Please check NODE_URL accessibility and PRIVATE_KEY validity.'
        );
        process.exit(1); // Exit if SDK initialization fails
    }
}

// --- Document Stamping API Endpoint ---
app.post('/api/stamp', async (req, res) => {
    try {
        const { documentHash } = req.body;
        
        if (!documentHash || typeof documentHash !== 'string' || !documentHash.startsWith('0x') || documentHash.length !== 66) {
            return res.status(400).json({ 
                error: 'Invalid documentHash. Must be a 0x-prefixed 32-byte hash (66 characters total).' 
            });
        }

        logger.info('📝 Initiating LIVE Testnet Stamp', `Document Hash: ${documentHash}`);

        // Create transaction clause for REAL contract stamping
const clause = Clause.callFunction(
    Address.of(VECHAIN_CONTRACT),
    '0x' + ABI.encodeFunctionSignature('stampDocument(bytes32)'), // CORRECT FOR v2.0.4
    [documentHash]
);

        // Get current blockchain state
        const bestBlockRef = await thorClient.blocks.getBestBlockCompressed();
        const genesisBlock = await thorClient.blocks.getBlockCompressed(0);

        // Build transaction
        const transaction = new Transaction({
            chainTag: Number(genesisBlock.id.slice(-2)), // Derives chainTag from genesis block
            blockRef: bestBlockRef.id.slice(0, 18),
            expiration: 33, // Default expiry 33 blocks (~330s)
            clauses: [clause],
            gasPriceCoef: 0, // Use default gas price
            gas: 0, // Auto-estimate gas if 0, or specify a safe value like 21000 for simple transfers
            dependsOn: null,
            nonce: Date.now() // Simple nonce for unique transactions
        });

        // Sign transaction with private key
        const privateKeyBytes = Hex.of(PRIVATE_KEY).bytes;
        const signedTransaction = Transaction.of(transaction).sign(privateKeyBytes);

        // Send transaction to blockchain
        const result = await thorClient.transactions.sendTransaction(signedTransaction);

        // Wait for transaction receipt
        const receipt = await thorClient.transactions.waitForTransaction(result.id);

        // ✅ SUCCESS RESPONSE
        const response = {
            success: true,
            txHash: result.id,
            blockNumber: receipt.meta.blockNumber,
            gasUsed: receipt.gasUsed,
            explorerUrl: `https://testnet.vechain.energy/transactions/${result.id}`,
            documentHash: documentHash,
            timestamp: new Date().toISOString()
        };

        logger.info( 
            '✅ LIVE Stamp Successful', 
            `TX Hash: ${result.id}`,
            `Block: ${receipt.meta.blockNumber}`,
            `Gas Used: ${receipt.gasUsed}`
        );

        res.json(response);

    } catch (error) {
        // ✅ FIXED ERROR HANDLING - Now uses working logger.error method
        logger.error( 
            '❌ LIVE Stamp Failed', 
            error.message 
        );
        res.status(500).json({ 
            success: false, 
            error: 'Failed to stamp document on VeChain: ' + error.message 
        });
    }
});

// --- Health Check Endpoint ---
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Start Server ---
async function startServer() {
    try {
        await initializeVeChainSDK(); // Initialize SDK before starting server
        
        const server = app.listen(PORT, () => {
            console.log(`\n🌐 VeChain Document Stamper LIVE TESTNET`);
            console.log(`📡 Server running on http://localhost:${PORT}`);
            console.log(`🔗 Connected to Node: ${NODE_URL}`);
            console.log(`💳 Signer Wallet: ${signerAddress}`);
            console.log(`📜 Contract Address: ${VECHAIN_CONTRACT}`);
            console.log(`⛽ Get Testnet VTHO: https://faucet.vecha.in/`);
            console.log(`🔍 Testnet Explorer: https://testnet.vechain.energy/\n`);
        });

        server.on('error', (err) => {
            logger.error( 
                '❌ Server Initialization Error', 
                err.message,
                'Port might be in use or other network issues.'
            );
            process.exit(1);
        });

    } catch (error) {
        logger.error( 
            '❌ Failed to start server gracefully:', 
            error.message
        );
        process.exit(1);
    }
}

// Call the function to start the server
if (require.main === module) {
    startServer();
}

module.exports = { app, startServer }; // Export for potential testing or modular use
