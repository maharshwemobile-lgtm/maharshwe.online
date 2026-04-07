require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // optional, for security
const RATES_FILE = path.join(__dirname, 'rates.json');
const LAST_UPDATE_FILE = path.join(__dirname, 'last_update_id.txt');

// Middleware
app.use(express.json());
app.use(express.static('public'));

// ---------- Rate Storage Helpers ----------
function loadRates() {
    try {
        const data = fs.readFileSync(RATES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        // Default fallback rates
        return {
            bid: 132.45,
            ask: 136.05,
            last_update: new Date().toISOString(),
            date: new Date().toISOString().slice(0,10)
        };
    }
}

function saveRates(rates) {
    fs.writeFileSync(RATES_FILE, JSON.stringify(rates, null, 2));
}

// Check if rates are from today, otherwise return null (needs update)
function getValidRates() {
    const rates = loadRates();
    const today = new Date().toISOString().slice(0,10);
    if (rates.date === today) {
        return rates;
    }
    return null; // expired, need admin to update
}

// Update rates from admin command
function updateRates(bid, ask) {
    const newRates = {
        bid: parseFloat(bid),
        ask: parseFloat(ask),
        last_update: new Date().toISOString(),
        date: new Date().toISOString().slice(0,10)
    };
    saveRates(newRates);
    return newRates;
}

// ---------- Telegram Polling (getUpdates) ----------
let lastUpdateId = 0;
if (fs.existsSync(LAST_UPDATE_FILE)) {
    lastUpdateId = parseInt(fs.readFileSync(LAST_UPDATE_FILE, 'utf8')) || 0;
}

async function pollTelegram() {
    if (!BOT_TOKEN) return;
    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
        const response = await axios.get(url);
        const updates = response.data.result;
        for (const update of updates) {
            lastUpdateId = update.update_id;
            const msg = update.message;
            if (msg && msg.text && msg.text.startsWith('/rate')) {
                // Only allow admin chat id if set, else allow anyone (but better to restrict)
                if (ADMIN_CHAT_ID && msg.chat.id.toString() !== ADMIN_CHAT_ID) {
                    continue;
                }
                const parts = msg.text.split(' ');
                if (parts.length >= 3) {
                    const bid = parseFloat(parts[1]);
                    const ask = parseFloat(parts[2]);
                    if (!isNaN(bid) && !isNaN(ask)) {
                        updateRates(bid, ask);
                        // Send confirmation
                        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                            chat_id: msg.chat.id,
                            text: `✅ Rate updated: Buy ${bid} / Sell ${ask} (4% fee will be applied automatically)`
                        });
                    }
                }
            }
        }
        fs.writeFileSync(LAST_UPDATE_FILE, lastUpdateId.toString());
    } catch (err) {
        console.error('Telegram polling error:', err.message);
    }
}

// Poll every 10 seconds
setInterval(pollTelegram, 10000);
pollTelegram(); // initial run

// ---------- API Endpoints ----------
// Spreads configuration (can be changed by editing here or later from admin)
const SPREADS = {
    mmk_to_thb_bankdeposit: 0,      // base +4% only
    thb_to_mmk_kpay: 0.5,           // extra 0.5 MMK per THB
    thb_to_mmk_cash: -1.2           // discount 1.2 MMK per THB
};

app.get('/api/rate', (req, res) => {
    let rates = getValidRates();
    if (!rates) {
        return res.status(503).json({ error: 'Rates not updated today. Please contact admin.' });
    }
    
    const baseBid = rates.bid;
    const baseAsk = rates.ask;
    const feeMultiplier = 1.04; // 4% service fee
    
    // MMK -> THB (user gives MMK, gets THB) => use ASK rate
    const mmkToThbBase = baseAsk * feeMultiplier;
    const mmkToThbRate = mmkToThbBase + SPREADS.mmk_to_thb_bankdeposit;
    
    // THB -> MMK (user gives THB, gets MMK) => use BID rate
    const thbToMmkBase = baseBid * feeMultiplier;
    const thbToMmkKpay = thbToMmkBase + SPREADS.thb_to_mmk_kpay;
    const thbToMmkCash = thbToMmkBase + SPREADS.thb_to_mmk_cash;
    
    res.json({
        success: true,
        last_update: rates.last_update,
        rates: {
            mmk_to_thb: {
                bank_deposit: parseFloat(mmkToThbRate.toFixed(2))
            },
            thb_to_mmk: {
                kpay: parseFloat(thbToMmkKpay.toFixed(2)),
                cash: parseFloat(thbToMmkCash.toFixed(2))
            }
        }
    });
});

app.get('/api/bank-info', (req, res) => {
    const bankInfo = {
        kbz_pay: { name: "Khun Myint Aung", number: "09778394052" },
        kbz_bank: { name: "Khun Myint Aung", account: "34551107002743002" },
        truemoney: { name: "Khun Myint Aung", number: "0944070246" },
        krungthai: { name: "Khun Myint Aung", account: "000-3-35 722-8" },
        contact: {
            telegram: "https://t.me/Mylifemychoice68",
            telegram_chat_id: "6961343629",
            phone_mm: "09778394052"
        },
        accept_methods: ["KBZ Bank", "KBZ Pay", "True Money", "PromptPay (Thailand)", "Thailand Bank Account"]
    };
    res.json(bankInfo);
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});