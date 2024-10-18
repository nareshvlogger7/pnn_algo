const express = require('express');
const bodyParser = require('body-parser');
const { SmartAPI } = require('smartapi-javascript');
const OpeningRangeBreakout = require('./opening_range_breakout'); // Adjust path as necessary
const YesterdayRangeBreakout = require('./yesterday_range_breakout'); // Adjust path as necessary
const { linearRegression, logisticRegression, shouldBuyLR, shouldSellLR, shouldBuyLG, shouldSellLG } = require('./golden_strategies'); // Adjust path as necessary

const app = express();
const port = 3000;
let smartApiInstance = null;
let sessionData = null;
let instrumentList = null; // This will hold your instrument list

app.use(bodyParser.json());

// Route to handle login (Session generation)
app.post('/login', async (req, res) => {
    const { clientCode, apiKey, password, totp } = req.body;

    try {
        smartApiInstance = new SmartAPI({ api_key: apiKey });
        sessionData = await smartApiInstance.generateSession(clientCode, password, totp);
        
        if (sessionData.status === 'success') {
            // Fetch the instrument list here if needed
            instrumentList = await smartApiInstance.getScripMaster(); // Example function to get instruments
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route to start backend activities (run strategies)
app.post('/start', async (req, res) => {
    if (!smartApiInstance || !sessionData) {
        return res.status(400).json({ success: false, message: 'Session not initialized' });
    }

    try {
        // Example: Running Opening Range Breakout Strategy
        const orbStrategy = new OpeningRangeBreakout(smartApiInstance);
        const hiLoPrices = {}; // Provide your high-low price mapping here
        const positions = await smartApiInstance.getPosition(); // Fetch current positions
        const openOrders = await smartApiInstance.getOrderBook(); // Fetch open orders
        await orbStrategy.orbStrat(['WIPRO', 'TCS'], hiLoPrices, positions, openOrders);

        // Example: Running Yesterday's Range Breakout Strategy
        const yrbStrategy = new YesterdayRangeBreakout(smartApiInstance, instrumentList);
        await yrbStrategy.rangeBreakout(['WIPRO', 'TCS']);

        // Example: Running Golden Strategies (Linear and Logistic Regression)
        const trainData = []; // Load or generate your training data
        const testData = []; // Load or generate your test data
        const linearResults = linearRegression(trainData, testData);
        const logisticResults = logisticRegression(trainData, testData);

        // Use conditions to place orders based on the results
        const currentPrice = 2000; // Replace with actual current price
        const previousHigh = 1980; // Replace with previous high
        const previousLow = 1950; // Replace with previous low
        const currentVolume = 1000; // Replace with actual current volume
        const averageVolume = 800; // Replace with calculated average volume

        if (shouldBuyLR(currentPrice, previousHigh, previousLow, currentVolume, averageVolume)) {
            await placeOrder('BUY', 'WIPRO', 2000, 1); // Example order
        }

        if (shouldSellLR(currentPrice, previousHigh, previousLow, currentVolume, averageVolume)) {
            await placeOrder('SELL', 'WIPRO', 1980, 1); // Example order
        }

        res.json({ success: true, message: 'Strategies executed successfully' });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Function to place an order
async function placeOrder(transactionType, tradingSymbol, price, quantity) {
    try {
        const orderResponse = await smartApiInstance.placeOrder({
            variety: "NORMAL",
            tradingsymbol: tradingSymbol,
            symboltoken: "3045", // Replace with actual token
            transactiontype: transactionType,
            exchange: "NSE", // Adjust as necessary
            ordertype: "LIMIT",
            producttype: "INTRADAY",
            duration: "DAY",
            price: price,
            squareoff: "0",
            stoploss: "0",
            quantity: quantity
        });
        console.log('Order placed successfully: ', orderResponse);
        return orderResponse;
    } catch (error) {
        console.error('Error placing order: ', error);
    }
}

// Start the server
app.listen(port, () => {
    console.log(`Backend server is running on http://localhost:${3000}`);
});
