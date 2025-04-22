const apiKey = "demo";
let stockChart = null;
let currentSymbol = ""; // Lưu tạm mã đang xem để thêm yêu thích

async function getStockPrice(customSymbol, isRefresh) {
  // Nếu là refresh thì sử dụng symbol hiện tại, nếu không thì lấy từ input
  const symbol = isRefresh ? currentSymbol : (customSymbol || document.getElementById("symbol-input").value.trim().toUpperCase() || "MSFT");
  currentSymbol = symbol;
  
  // Hiển thị loading
  const loadingIndicator = document.getElementById("loading-indicator");
  const stockInfo = document.getElementById("stock-info");
  const addFavBtn = document.getElementById("add-favorite-btn");
  const priceAlert = document.getElementById("price-alert");
  
  // Ẩn kết quả cũ và hiện loading
  stockInfo.innerHTML = "";
  loadingIndicator.classList.remove("hidden");
  priceAlert.classList.add("hidden");
  document.getElementById("stockChart").style.display = "none";
  addFavBtn.style.display = "none";

  try {
    // Code gọi API như cũ
    const priceUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
    const historyUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}`;
    const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`;

    const [priceRes, historyRes, overviewRes] = await Promise.all([
      fetch(priceUrl),
      fetch(historyUrl),
      fetch(overviewUrl)
    ]);

    const priceData = await priceRes.json();
    const historyData = await historyRes.json();
    const overviewData = await overviewRes.json();

    const quote = priceData["Global Quote"];
    const timeSeries = historyData["Time Series (Daily)"];
    const companyName = overviewData.Name;

    if (!quote || !timeSeries) {
      stockInfo.innerHTML = `<p>Không lấy được dữ liệu, thử lại với mã khác.</p>`;
      document.getElementById("stockChart").style.display = "none";
      addFavBtn.style.display = "none";
      return;
    }

    stockInfo.innerHTML = `
      <h2>${symbol}</h2>
      <p><strong>Tên công ty:</strong> ${companyName || "Không rõ"}</p>
      <p><strong>Giá hiện tại:</strong> $${parseFloat(quote["05. price"]).toFixed(2)}</p>
      <p><strong>Thay đổi:</strong> ${quote["09. change"]} USD</p>
      <p><strong>Tỷ lệ thay đổi:</strong> ${quote["10. change percent"]}</p>
    `;

    // Kiểm tra cảnh báo giá
    const currentPrice = parseFloat(quote["05. price"]);
    checkPriceAlerts(symbol, currentPrice);

    // Hiển thị nút cài đặt cảnh báo
    document.getElementById("toggle-alert-btn").style.display = "inline-block";

    // Hiển thị cảnh báo tăng/giảm giá
    const priceAlert = document.getElementById("price-alert");
    const changePercent = parseFloat(quote["10. change percent"]);

    if (!isNaN(changePercent)) {
      priceAlert.classList.remove("hidden", "up", "down");
      if (changePercent > 0) {
        priceAlert.classList.add("up");
        priceAlert.textContent = `🔔 Cổ phiếu ${symbol} đang tăng giá (+${changePercent}%)`;
      } else if (changePercent < 0) {
        priceAlert.classList.add("down");
        priceAlert.textContent = `🔔 Cổ phiếu ${symbol} đang giảm giá (${changePercent}%)`;
      } else {
        priceAlert.classList.add("up");
        priceAlert.textContent = `🔔 Cổ phiếu ${symbol} không đổi.`;
      }
    } else {
      priceAlert.classList.add("hidden");
    }


    // Hiển thị nút "Thêm vào yêu thích"
    addFavBtn.style.display = "inline-block";

    const dates = Object.keys(timeSeries).slice(0, 30).reverse();
    const prices = dates.map(date => parseFloat(timeSeries[date]["4. close"]));

    const ctx = document.getElementById("stockChart").getContext("2d");
    if (stockChart && typeof stockChart.destroy === "function") {
      stockChart.destroy();
    }

    stockChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: dates,
        datasets: [{
          label: "Giá đóng cửa (30 ngày)",
          data: prices,
          borderColor: "blue",
          fill: false,
          tension: 0.2
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: { title: { display: true, text: "Ngày" } },
          y: { title: { display: true, text: "Giá ($)" } }
        }
      }
    });

    // Cập nhật thông tin danh mục đầu tư nếu có
    const favoriteList = document.getElementById("favorite-list");
    const portfolioItem = Array.from(favoriteList.children).find(li => li.dataset.symbol === symbol);
    if (portfolioItem) {
      const sharesInput = portfolioItem.querySelector(".shares-input");
      const buyPriceInput = portfolioItem.querySelector(".buy-price-input");
      
      if (sharesInput && buyPriceInput) {
        const shares = parseFloat(sharesInput.value);
        const buyPrice = parseFloat(buyPriceInput.value);
        
        if (shares && buyPrice) {
          updatePortfolioDisplay(portfolioItem, parseFloat(quote["05. price"]), shares, buyPrice);
        }
      }
    }

    document.getElementById("stockChart").style.display = "block";
    loadingIndicator.classList.add("hidden");
  } catch (error) {
    // Xử lý lỗi
    stockInfo.innerHTML = `<p>Đã xảy ra lỗi khi kết nối API.</p>`;
    console.error("Lỗi kết nối:", error);
    
    // Cũng cần ẩn loading khi gặp lỗi
    loadingIndicator.classList.add("hidden");
    addFavBtn.style.display = "none";
  }
  setTimeout(() => {
    document.getElementById("loading-indicator").classList.add("hidden");
  }, 5000);
}

// Xử lý hiển thị/ẩn phần cài đặt cảnh báo
function toggleAlertSettings() {
  const alertSettings = document.getElementById("alert-settings");
  alertSettings.classList.toggle("hidden");
  
  // Hiển thị giá trị cảnh báo đã lưu (nếu có)
  const symbol = currentSymbol;
  if (symbol) {
    const alertData = JSON.parse(localStorage.getItem(`alert_${symbol}`) || "{}");
    document.getElementById("alert-upper").value = alertData.upper || "";
    document.getElementById("alert-lower").value = alertData.lower || "";
  }
}

// Lưu cài đặt cảnh báo
function saveAlertSettings() {
  const symbol = currentSymbol;
  if (!symbol) return;
  
  const upperLimit = document.getElementById("alert-upper").value;
  const lowerLimit = document.getElementById("alert-lower").value;
  
  // Lưu vào localStorage
  localStorage.setItem(`alert_${symbol}`, JSON.stringify({
    upper: upperLimit || null,
    lower: lowerLimit || null
  }));
  
  // Thông báo
  alert(`Đã lưu cảnh báo cho ${symbol}`);
  
  // Ẩn phần cài đặt
  document.getElementById("alert-settings").classList.add("hidden");
}

// Kiểm tra và hiển thị cảnh báo nếu giá vượt ngưỡng
function checkPriceAlerts(symbol, currentPrice) {
  if (!symbol || !currentPrice) return;
  
  const alertData = JSON.parse(localStorage.getItem(`alert_${symbol}`) || "{}");
  const upperLimit = parseFloat(alertData.upper);
  const lowerLimit = parseFloat(alertData.lower);
  
  // Kiểm tra ngưỡng trên
  if (!isNaN(upperLimit) && currentPrice > upperLimit) {
    showPriceNotification(`🔔 ${symbol} đã vượt ngưỡng ${upperLimit}! Giá hiện tại: ${currentPrice}`);
  }
  
  // Kiểm tra ngưỡng dưới
  if (!isNaN(lowerLimit) && currentPrice < lowerLimit) {
    showPriceNotification(`🔔 ${symbol} đã xuống dưới ngưỡng ${lowerLimit}! Giá hiện tại: ${currentPrice}`);
  }
}

// Hiển thị thông báo giá
function showPriceNotification(message) {
  // Tạo phần tử thông báo
  const notification = document.createElement("div");
  notification.className = "price-notification";
  notification.textContent = message;
  
  // Thêm vào body
  document.body.appendChild(notification);
  
  // Xóa sau 5 giây
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// Thay đổi hàm addToFavorites() để thêm thông tin đầu tư
function addToFavorites() {
  const symbol = currentSymbol;
  if (!symbol) return;

  const favoriteList = document.getElementById("favorite-list");
  
  // Tìm phần tử nếu đã tồn tại
  const existingLi = Array.from(favoriteList.children).find(li => li.dataset.symbol === symbol);
  
  // Nếu đã tồn tại thì xóa
  if (existingLi) {
    existingLi.remove();
  }

  // Lấy thông tin cổ phiếu đang xem
  const stockInfo = document.getElementById("stock-info");
  const currentPrice = stockInfo.querySelector("p:nth-child(3)")?.textContent || "";
  const priceMatch = currentPrice.match(/\$([0-9.]+)/);
  const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

  // Tạo phần tử mới
  const li = document.createElement("li");
  li.dataset.symbol = symbol;
  li.innerHTML = `
    <div class="favorite-item">
      <div class="favorite-header">
        <span class="favorite-symbol" onclick="getStockPriceFromFavorite('${symbol}')">${symbol}</span>
        <button class="remove-btn" onclick="removeFromFavorites(this, '${symbol}')">X</button>
      </div>
      <div class="portfolio-inputs">
        <input type="number" class="shares-input" placeholder="Số lượng" min="0" step="1" 
              onchange="updatePortfolioValue('${symbol}', this)">
        <input type="number" class="buy-price-input" placeholder="Giá mua" min="0" step="0.01"
              onchange="updatePortfolioValue('${symbol}', this)">
      </div>
      <div class="portfolio-value">
        <div class="value-display">
          <span>Giá trị: </span><span class="current-value">$0.00</span>
        </div>
        <div class="pl-display">
          <span>P/L: </span><span class="profit-loss">$0.00 (0%)</span>
        </div>
      </div>
      <input type="text" class="stock-note" placeholder="Ghi chú..." 
            oninput="localStorage.setItem('note_${symbol}', this.value);">
    </div>
  `;
  
  favoriteList.appendChild(li);
  
  // Khôi phục dữ liệu đã lưu
  const portfolioData = JSON.parse(localStorage.getItem(`portfolio_${symbol}`) || "{}");
  if (portfolioData.shares) {
    li.querySelector(".shares-input").value = portfolioData.shares;
  }
  if (portfolioData.buyPrice) {
    li.querySelector(".buy-price-input").value = portfolioData.buyPrice;
  }
  
  // Khôi phục ghi chú
  const note = localStorage.getItem(`note_${symbol}`);
  if (note) {
    li.querySelector(".stock-note").value = note;
  }
  
  // Cập nhật giá trị nếu có dữ liệu
  if (price && portfolioData.shares && portfolioData.buyPrice) {
    updatePortfolioDisplay(li, price, portfolioData.shares, portfolioData.buyPrice);
  }
  
  // Lưu danh sách yêu thích
  saveFavorites();
}

// Lưu danh sách yêu thích vào localStorage
function saveFavorites() {
  const favoriteList = document.getElementById("favorite-list");
  const favorites = Array.from(favoriteList.children).map(li => {
    return {
      symbol: li.dataset.symbol,
      note: li.querySelector('.stock-note').value
    };
  });
  
  localStorage.setItem('favorites', JSON.stringify(favorites));
}

// Tải danh sách yêu thích từ localStorage
function loadFavorites() {
  const favoritesJson = localStorage.getItem('favorites');
  if (!favoritesJson) return;
  
  try {
    const favorites = JSON.parse(favoritesJson);
    favorites.forEach(fav => {
      // Lưu symbol hiện tại tạm thời
      currentSymbol = fav.symbol;
      
      // Thêm vào danh sách (sử dụng hàm đã có)
      addToFavorites();
    });
  } catch (e) {
    console.error("Lỗi khi tải danh sách yêu thích:", e);
  }
}

// Cho phép tra cứu lại khi click vào mã yêu thích
function getStockPriceFromFavorite(symbol) {
  document.getElementById("symbol-input").value = symbol;
  getStockPrice();
}

window.onload = function () {
  document.getElementById("toggle-alert-btn").addEventListener("click", toggleAlertSettings);
  document.getElementById("save-alert-btn").addEventListener("click", saveAlertSettings);
  // Tải danh sách yêu thích trước
  loadFavorites();
  
  // Tải thông tin cổ phiếu mặc định
  getStockPrice('MSFT');

  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  
  // Kiểm tra nếu người dùng đã chọn chế độ tối trước đó
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-theme");
    themeToggleBtn.textContent = "☀️ Chế độ sáng";
  }
  
  themeToggleBtn.addEventListener("click", function() {
    // Chuyển đổi chế độ
    document.body.classList.toggle("dark-theme");
    
    // Lưu tùy chọn
    if (document.body.classList.contains("dark-theme")) {
      localStorage.setItem("theme", "dark");
      themeToggleBtn.textContent = "☀️ Chế độ sáng";
    } else {
      localStorage.setItem("theme", "light");
      themeToggleBtn.textContent = "🌙 Chế độ tối";
    }
  });
};

// Lưu thông tin đầu tư (số lượng và giá mua)
function updatePortfolioValue(symbol, inputElement) {
  const li = inputElement.closest("li");
  const sharesInput = li.querySelector(".shares-input");
  const buyPriceInput = li.querySelector(".buy-price-input");
  
  const shares = parseFloat(sharesInput.value);
  const buyPrice = parseFloat(buyPriceInput.value);
  
  // Lưu vào localStorage
  localStorage.setItem(`portfolio_${symbol}`, JSON.stringify({
    shares: shares || 0,
    buyPrice: buyPrice || 0
  }));
  
  // Lấy giá hiện tại từ API để cập nhật giá trị
  fetchCurrentPrice(symbol, price => {
    if (price) {
      updatePortfolioDisplay(li, price, shares, buyPrice);
    }
  });
}

// Hàm lấy giá hiện tại
async function fetchCurrentPrice(symbol, callback) {
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    const quote = data["Global Quote"];
    if (quote && quote["05. price"]) {
      const price = parseFloat(quote["05. price"]);
      callback(price);
    } else {
      callback(0);
    }
  } catch (error) {
    console.error("Lỗi khi lấy giá hiện tại:", error);
    callback(0);
  }
}

// Cập nhật hiển thị giá trị danh mục
function updatePortfolioDisplay(li, currentPrice, shares, buyPrice) {
  if (!shares || !buyPrice || !currentPrice) return;
  
  const currentValue = shares * currentPrice;
  const initialValue = shares * buyPrice;
  const profitLoss = currentValue - initialValue;
  const profitLossPercent = (profitLoss / initialValue) * 100;
  
  const currentValueEl = li.querySelector(".current-value");
  const profitLossEl = li.querySelector(".profit-loss");
  
  currentValueEl.textContent = `$${currentValue.toFixed(2)}`;
  
  profitLossEl.textContent = `$${profitLoss.toFixed(2)} (${profitLossPercent.toFixed(2)}%)`;
  profitLossEl.className = "profit-loss";
  
  if (profitLoss > 0) {
    profitLossEl.classList.add("profit");
  } else if (profitLoss < 0) {
    profitLossEl.classList.add("loss");
  }
}

function removeFromFavorites(element, symbol) {
  // Ngăn sự kiện lan ra
  event.stopPropagation();
  
  const confirmDelete = confirm(`Bạn có muốn xóa cổ phiếu ${symbol} khỏi danh sách yêu thích không?`);
  
  if (confirmDelete) {
    const keepData = confirm(`Bạn có muốn giữ lại dữ liệu (số lượng, giá mua, ghi chú) của cổ phiếu ${symbol} không?`);
    
    // Xóa phần tử HTML
    element.parentNode.parentNode.parentNode.remove();
    
    if (!keepData) {
      // Xóa tất cả dữ liệu liên quan
      localStorage.removeItem(`portfolio_${symbol}`);
      localStorage.removeItem(`note_${symbol}`);
      localStorage.removeItem(`alert_${symbol}`);
    }
    
    // Lưu lại danh sách yêu thích
    saveFavorites();
  }
}