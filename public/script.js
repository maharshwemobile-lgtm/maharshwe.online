let currentRates = {
    mmk_to_thb: { bank_deposit: 0 },
    thb_to_mmk: { kpay: 0, cash: 0 }
};
let currentDirection = 'thb_to_mmk'; // 'thb_to_mmk' or 'mmk_to_thb'
let currentMethod = 'kpay'; // kpay or cash (for thb_to_mmk)

// DOM elements
const rateKpaySpan = document.getElementById('rateKpay');
const rateCashSpan = document.getElementById('rateCash');
const rateBankSpan = document.getElementById('rateBankDeposit');
const updateTimeSpan = document.getElementById('updateTime');
const amountInput = document.getElementById('amountInput');
const resultOutput = document.getElementById('resultOutput');
const fromCurrencyLabel = document.getElementById('fromCurrencyLabel');
const toCurrencyLabel = document.getElementById('toCurrencyLabel');
const fromSymbol = document.getElementById('fromSymbol');
const toSymbol = document.getElementById('toSymbol');
const methodContainer = document.getElementById('methodContainer');
const btnMmkToThb = document.getElementById('btnMmkToThb');
const btnThbToMmk = document.getElementById('btnThbToMmk');
const confirmBtn = document.getElementById('confirmBtn');
const modal = document.getElementById('infoModal');
const modalBody = document.getElementById('modalBody');
const closeModal = document.querySelector('.close');
const copyAllBtn = document.getElementById('copyAllBtn');

// Fetch rates from backend
async function fetchRates() {
    try {
        const res = await fetch('/api/rate');
        const data = await res.json();
        if (data.success) {
            currentRates = data.rates;
            updateTimeSpan.innerText = new Date(data.last_update).toLocaleString();
            // Update cards
            rateKpaySpan.innerText = currentRates.thb_to_mmk.kpay.toFixed(2);
            rateCashSpan.innerText = currentRates.thb_to_mmk.cash.toFixed(2);
            rateBankSpan.innerText = currentRates.mmk_to_thb.bank_deposit.toFixed(2);
            // Recalculate
            calculateConversion();
        } else if (data.error) {
            alert(data.error);
        }
    } catch (err) {
        console.error(err);
        alert('Rate ရယူရာတွင် အမှားရှိပါသည်။ နောက်မှထပ်ကြည့်ပါ။');
    }
}

// Calculate based on direction, method, amount
function calculateConversion() {
    let amount = parseFloat(amountInput.value);
    if (isNaN(amount)) amount = 0;
    let result = 0;
    if (currentDirection === 'thb_to_mmk') {
        // THB -> MMK
        let rate = currentMethod === 'kpay' ? currentRates.thb_to_mmk.kpay : currentRates.thb_to_mmk.cash;
        result = amount * rate;
        fromCurrencyLabel.innerText = 'သင်ပေးမည့်ငွေ (THB)';
        toCurrencyLabel.innerText = 'သင်ရမည့်ငွေ (MMK)';
        fromSymbol.innerText = 'THB';
        toSymbol.innerText = 'MMK';
    } else {
        // MMK -> THB (only bank deposit)
        let rate = currentRates.mmk_to_thb.bank_deposit;
        result = amount / rate;  // because rate is MMK per 1 THB, so MMK / rate = THB
        fromCurrencyLabel.innerText = 'သင်ပေးမည့်ငွေ (MMK)';
        toCurrencyLabel.innerText = 'သင်ရမည့်ငွေ (THB)';
        fromSymbol.innerText = 'MMK';
        toSymbol.innerText = 'THB';
    }
    resultOutput.value = result.toFixed(2);
}

// Change direction (MMK->THB or THB->MMK)
function setDirection(direction) {
    currentDirection = direction;
    if (direction === 'thb_to_mmk') {
        btnThbToMmk.classList.add('active');
        btnMmkToThb.classList.remove('active');
        methodContainer.style.display = 'block';
        // re-read selected method
        const selected = document.querySelector('input[name="paymentMethod"]:checked');
        if (selected) currentMethod = selected.value;
    } else {
        btnMmkToThb.classList.add('active');
        btnThbToMmk.classList.remove('active');
        methodContainer.style.display = 'none';
    }
    calculateConversion();
}

// Listen to method radio buttons
document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (currentDirection === 'thb_to_mmk') {
            currentMethod = e.target.value;
            calculateConversion();
        }
    });
});

// Amount input event
amountInput.addEventListener('input', calculateConversion);

// Show modal with bank info
async function showBankInfo() {
    try {
        const res = await fetch('/api/bank-info');
        const info = await res.json();
        let html = `
            <div class="bank-detail"><strong>🏦 KBZ Pay</strong><br>${info.kbz_pay.name}<br>📞 ${info.kbz_pay.number}</div>
            <div class="bank-detail"><strong>🏦 KBZ Special Bank</strong><br>${info.kbz_bank.name}<br>💳 ${info.kbz_bank.account}</div>
            <div class="bank-detail"><strong>💰 True Money</strong><br>${info.truemoney.name}<br>📞 ${info.truemoney.number}</div>
            <div class="bank-detail"><strong>🇹🇭 Krungthai Bank (Thailand)</strong><br>${info.krungthai.name}<br>💳 ${info.krungthai.account}</div>
            <div class="bank-detail"><strong>📱 Admin Contact</strong><br>Telegram: <a href="${info.contact.telegram}" target="_blank">${info.contact.telegram}</a><br>Phone (Myanmar): ${info.contact.phone_mm}</div>
            <p style="margin-top:12px; font-size:0.8rem;">✅ ငွေလွှဲပြီးပါက Slip နှင့် ပမာဏကို Admin သို့ ပေးပို့ပါ။</p>
        `;
        modalBody.innerHTML = html;
        modal.style.display = 'flex';
    } catch (err) {
        alert('Bank info ရယူရန် မအောင်မြင်ပါ။');
    }
}

confirmBtn.addEventListener('click', () => {
    // Optional: show summary before modal
    showBankInfo();
});

closeModal.onclick = () => modal.style.display = 'none';
window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

copyAllBtn.addEventListener('click', () => {
    const text = modalBody.innerText;
    navigator.clipboard.writeText(text).then(() => alert('အချက်အလက်များ ကူးယူပြီးပါပြီ။'));
});

// Initialization
fetchRates();
setDirection('thb_to_mmk');
setInterval(fetchRates, 30000); // refresh every 30 seconds