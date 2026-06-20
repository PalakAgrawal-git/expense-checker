/* =========================================================
   EXPENSE CHECKER — script.js
   All the app logic lives here. Sections:
   1. Local Storage keys & helpers      -> Budget Module + Expense Module
   2. Date / time / currency helpers
   3. DOM element references
   4. Render functions                  -> Analysis Module
   5. Chart.js setup                    -> Visualization Module
   6. Event listeners (budget form, expense form, delete, clear)
   7. Page startup

   (Module names match 03-ARCHITECTURE.docx: Budget, Expense,
   Analysis, and Visualization modules.)
   ========================================================= */

/* ---------------------------------------------------------
   1. LOCAL STORAGE KEYS & HELPERS
   We keep two things in Local Storage:
   - the monthly budget (a single number)         -> Budget Module
   - the list of expenses (an array of objects)    -> Expense Module
--------------------------------------------------------- */
const BUDGET_KEY = "expenseChecker_budget";
const EXPECTED_KEY = "expenseChecker_expectedExpense";
const EXPENSES_KEY = "expenseChecker_expenses";

// --- Budget Module ---
// Read the saved budget. Returns 0 if nothing was saved yet.
function getBudget() {
  const value = localStorage.getItem(BUDGET_KEY);
  return value ? Number(value) : 0;
}

// Save the budget as plain text in Local Storage.
function saveBudget(amount) {
  localStorage.setItem(BUDGET_KEY, String(amount));
}

// Expected Monthly Expense is a softer personal target that usually sits
// BELOW the hard budget ceiling (e.g. budget ₹5000, expected ₹4000).
// It gets its own warning/under-target message, separate from the budget one.
function getExpectedExpense() {
  const value = localStorage.getItem(EXPECTED_KEY);
  return value ? Number(value) : 0;
}

function saveExpectedExpense(amount) {
  localStorage.setItem(EXPECTED_KEY, String(amount));
}

// --- Expense Module ---
// Read the saved expenses list. Returns an empty array if nothing was saved yet.
// Each expense matches 04-DATA-MODEL.docx: { id, amount, category, purpose, date, time }.
function getExpenses() {
  const raw = localStorage.getItem(EXPENSES_KEY);
  return raw ? JSON.parse(raw) : [];
}

// Save the expenses list. Local Storage only stores text,
// so we convert the array to a JSON string with JSON.stringify.
function saveExpenses(expenses) {
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
}

/* ---------------------------------------------------------
   2. DATE / TIME / CURRENCY HELPERS
--------------------------------------------------------- */

// Builds every date format we need from one Date object,
// so the rest of the app always stays in sync.
function getDateParts(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0"); // 01-12
  const dd = String(d.getDate()).padStart(2, "0");      // 01-31

  return {
    iso: `${yyyy}-${mm}-${dd}`,                                   // used for filtering, e.g. 2026-06-18
    month: mm,
    year: String(yyyy),
    display: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
  };
}

// Turns a number into a rupee string, e.g. 12500 -> "₹12,500"
function formatCurrency(amount) {
  const rounded = Math.round(amount);
  return "₹" + rounded.toLocaleString("en-IN");
}

/* ---------------------------------------------------------
   3. DOM ELEMENT REFERENCES
   Grabbing everything once up top keeps the code below tidy.
--------------------------------------------------------- */
const todayLabel = document.getElementById("todayLabel");

const budgetForm = document.getElementById("budgetForm");
const budgetInput = document.getElementById("budgetInput");
const monthlyBudgetValue = document.getElementById("monthlyBudgetValue");
const expectedFootnote = document.getElementById("expectedFootnote");

const expectedForm = document.getElementById("expectedForm");
const expectedInput = document.getElementById("expectedInput");

const totalSpentValue = document.getElementById("totalSpentValue");
const remainingValue = document.getElementById("remainingValue");
const todaySpentValue = document.getElementById("todaySpentValue");
const todayCountValue = document.getElementById("todayCountValue");

const budgetRing = document.getElementById("budgetRing");
const ringPercent = document.getElementById("ringPercent");

const statusMessages = document.getElementById("statusMessages");

const expenseForm = document.getElementById("expenseForm");
const amountInput = document.getElementById("amountInput");
const categoryInput = document.getElementById("categoryInput");
const purposeInput = document.getElementById("purposeInput");
const autoDate = document.getElementById("autoDate");
const autoTime = document.getElementById("autoTime");

const expenseTableBody = document.getElementById("expenseTableBody");
const noExpenseMsg = document.getElementById("noExpenseMsg");
const clearAllBtn = document.getElementById("clearAllBtn");

/* ---------------------------------------------------------
   4. RENDER FUNCTIONS
   Each function reads from Local Storage and updates one
   part of the page. We call all of them together whenever
   the data changes, so the UI never goes out of sync.
--------------------------------------------------------- */

// Updates the live date shown in the header, and refreshes
// the auto-captured date/time fields on the expense form.
function renderClock() {
  const parts = getDateParts();
  todayLabel.textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric"
  });
  autoDate.value = parts.display;
  autoTime.value = parts.time;
}

// Shows the currently saved budget/expected values in their input
// fields, so reopening the page doesn't look like the settings were lost.
function prefillSettingsInputs() {
  const budget = getBudget();
  const expectedExpense = getExpectedExpense();
  budgetInput.value = budget > 0 ? budget : "";
  expectedInput.value = expectedExpense > 0 ? expectedExpense : "";
}

// --- Analysis Module ---
// Updates the 4 dashboard cards, the budget ring and the status banner(s).
function renderDashboard() {
  const budget = getBudget();
  const expectedExpense = getExpectedExpense();
  const expenses = getExpenses();
  const parts = getDateParts();

  // Filter expenses that belong to the current month/year.
  const monthExpenses = expenses.filter(e => e.month === parts.month && e.year === parts.year);
  const totalSpent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = budget - totalSpent;

  // Filter expenses that happened today.
  const todayExpenses = expenses.filter(e => e.iso === parts.iso);
  const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Update the card numbers.
  monthlyBudgetValue.textContent = formatCurrency(budget);
  totalSpentValue.textContent = formatCurrency(totalSpent);
  remainingValue.textContent = formatCurrency(remaining);
  todaySpentValue.textContent = formatCurrency(todayTotal);
  todayCountValue.textContent = `${todayExpenses.length} expense${todayExpenses.length === 1 ? "" : "s"} today`;
  expectedFootnote.textContent = expectedExpense > 0 ? `Target: ${formatCurrency(expectedExpense)}` : "";

  // Update the circular budget-used ring.
  const percentUsed = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;
  budgetRing.style.setProperty("--p", percentUsed);
  ringPercent.textContent = budget > 0 ? `${Math.round((totalSpent / budget) * 100)}%` : "—";
  budgetRing.classList.toggle("over-budget", budget > 0 && totalSpent > budget);

  // Build the warning / savings messages. There can be up to two of these:
  // one comparing spending against the hard Budget, and one comparing it
  // against the softer Expected Expense target.
  const messages = [];

  if (budget > 0) {
    if (totalSpent > budget) {
      messages.push({ type: "warning", text: "⚠️ You have exceeded your monthly expense limit" });
    } else {
      messages.push({ type: "success", text: `🎉 You saved ${formatCurrency(remaining)} this month` });
    }
  }

  if (expectedExpense > 0) {
    if (totalSpent > expectedExpense) {
      messages.push({
        type: "warning",
        text: `⚠️ You have crossed your expected monthly expense of ${formatCurrency(expectedExpense)}`
      });
    } else {
      const spare = expectedExpense - totalSpent;
      messages.push({
        type: "success",
        text: `🎉 You're within your expected expense of ${formatCurrency(expectedExpense)} — ${formatCurrency(spare)} to spare`
      });
    }
  }

  statusMessages.innerHTML = messages
    .map(m => `<div class="status-banner ${m.type}">${m.text}</div>`)
    .join("");
}

// Rebuilds the expense history table from scratch.
function renderTable() {
  const expenses = getExpenses();

  // Show newest expenses first.
  const sorted = [...expenses].sort((a, b) => b.id - a.id);

  if (sorted.length === 0) {
    expenseTableBody.innerHTML = "";
    noExpenseMsg.hidden = false;
    return;
  }
  noExpenseMsg.hidden = true;

  // Build one table row per expense. The "Purpose" column shows a small
  // colored pill for the category, then the purpose text the user typed.
  expenseTableBody.innerHTML = sorted.map(e => `
    <tr>
      <td>${e.dateDisplay}</td>
      <td>${e.time}</td>
      <td>
        <span class="cat-pill" style="background:${CATEGORY_COLORS[e.category]}">${e.category}</span>${e.purpose || e.category}
      </td>
      <td>${formatCurrency(e.amount)}</td>
      <td><button class="btn-delete" data-id="${e.id}">Delete</button></td>
    </tr>
  `).join("");
}

/* ---------------------------------------------------------
   5. CHART.JS SETUP — Visualization Module
   We keep the two chart objects in variables so we can
   update them instead of recreating them every time.
--------------------------------------------------------- */
let pieChart = null;
let lineChart = null;

const CATEGORY_COLORS = {
  Food: "#E07A5F",
  Travel: "#3D87B0",
  Shopping: "#C99A3E",
  Bills: "#6B5B95",
  Other: "#5C6F70"
};

function initCharts() {
  const pieCtx = document.getElementById("categoryPieChart");
  const lineCtx = document.getElementById("dailyTrendChart");

  pieChart = new Chart(pieCtx, {
    type: "pie",
    data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
    options: { plugins: { legend: { position: "bottom" } } }
  });

  lineChart = new Chart(lineCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Spent",
        data: [],
        borderColor: "#0E7C61",
        backgroundColor: "rgba(14, 124, 97, 0.15)",
        fill: true,
        tension: 0.35,
        pointBackgroundColor: "#0E7C61",
        pointRadius: 4
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// Recalculates chart data from this month's expenses and updates both charts.
function renderCharts() {
  const expenses = getExpenses();
  const parts = getDateParts();
  const monthExpenses = expenses.filter(e => e.month === parts.month && e.year === parts.year);

  const pieEmptyMsg = document.getElementById("pieEmptyMsg");
  const lineEmptyMsg = document.getElementById("lineEmptyMsg");

  // ---- Pie chart: total amount per category ----
  const categories = Object.keys(CATEGORY_COLORS);
  const categoryTotals = categories.map(cat =>
    monthExpenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0)
  );
  const hasCategoryData = categoryTotals.some(value => value > 0);

  // Show/hide the canvas FIRST. If we update the chart's data while the
  // canvas is still hidden from a previous empty state, Chart.js draws
  // onto a zero-size canvas and the chart stays blank until a manual
  // refresh — resizing right after un-hiding avoids that.
  document.getElementById("categoryPieChart").style.display = hasCategoryData ? "block" : "none";
  pieEmptyMsg.hidden = hasCategoryData;
  if (hasCategoryData) pieChart.resize();

  pieChart.data.labels = categories;
  pieChart.data.datasets[0].data = categoryTotals;
  pieChart.data.datasets[0].backgroundColor = categories.map(cat => CATEGORY_COLORS[cat]);
  pieChart.update();

  // ---- Line chart: total amount per day, in date order ----
  const totalsByDate = {};
  monthExpenses.forEach(e => {
    totalsByDate[e.iso] = (totalsByDate[e.iso] || 0) + e.amount;
  });
  const sortedDates = Object.keys(totalsByDate).sort();
  const dayLabels = sortedDates.map(iso => iso.slice(8, 10)); // just the day number
  const dayTotals = sortedDates.map(iso => totalsByDate[iso]);
  const hasLineData = sortedDates.length > 0;

  document.getElementById("dailyTrendChart").style.display = hasLineData ? "block" : "none";
  lineEmptyMsg.hidden = hasLineData;
  if (hasLineData) lineChart.resize();

  lineChart.data.labels = dayLabels;
  lineChart.data.datasets[0].data = dayTotals;
  lineChart.update();
}

// Calls every render function — used after any data change.
function renderAll() {
  renderDashboard();
  renderTable();
  renderCharts();
}

/* ---------------------------------------------------------
   6. EVENT LISTENERS
--------------------------------------------------------- */

// Saving the monthly budget.
budgetForm.addEventListener("submit", function (event) {
  event.preventDefault(); // stop the page from reloading
  const amount = Number(budgetInput.value);
  if (amount < 0) return;
  saveBudget(amount);
  renderAll();
});

// Saving the expected monthly expense (a softer target under the budget).
expectedForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const amount = Number(expectedInput.value);
  if (amount < 0) return;
  saveExpectedExpense(amount);
  renderAll();
});

// Adding a new expense.
expenseForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const amount = Number(amountInput.value);
  if (amount <= 0) return;

  const parts = getDateParts(); // captures the current date & time automatically

  // Purpose is optional — fall back to the category name so the
  // history table never shows a blank cell.
  const purpose = purposeInput.value.trim() || categoryInput.value;

  const newExpense = {
    id: Date.now(),               // unique id, also used for "newest first" sorting
    amount: amount,
    category: categoryInput.value,
    purpose: purpose,
    iso: parts.iso,
    dateDisplay: parts.display,
    time: parts.time,
    month: parts.month,
    year: parts.year
  };

  const expenses = getExpenses();
  expenses.push(newExpense);
  saveExpenses(expenses);

  amountInput.value = "";
  purposeInput.value = "";
  renderAll();
});

// Deleting a single expense (event delegation: one listener for the whole table).
expenseTableBody.addEventListener("click", function (event) {
  if (!event.target.classList.contains("btn-delete")) return;

  const idToRemove = Number(event.target.dataset.id);
  const expenses = getExpenses().filter(e => e.id !== idToRemove);
  saveExpenses(expenses);
  renderAll();
});

// Clearing every expense.
clearAllBtn.addEventListener("click", function () {
  const confirmed = confirm("This will delete all your expenses. Are you sure?");
  if (!confirmed) return;
  saveExpenses([]);
  renderAll();
});

/* ---------------------------------------------------------
   7. PAGE STARTUP
   Runs once when the page first loads.
--------------------------------------------------------- */
renderClock();
prefillSettingsInputs();
initCharts();
renderAll();

// Keep the auto date/time fields fresh if the page is left open.
setInterval(renderClock, 30000);
