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

window.onload = function() {
  // Đăng ký sự kiện cho các nút
  document.getElementById("toggle-alert-btn").addEventListener("click", toggleAlertSettings);
  document.getElementById("save-alert-btn").addEventListener("click", saveAlertSettings);
  document.getElementById("toggle-ai-assistant-btn").classList.add("hidden");
  
  // Khởi tạo trợ lý AI
  initializeAIAssistant();
  
  // Tải danh sách yêu thích
  loadFavorites();
  
  // Tải thông tin cổ phiếu mặc định
  getStockPrice('MSFT');

  // Thiết lập chức năng chuyển đổi chủ đề
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

// Thêm JavaScript để xử lý trợ lý AI
function initializeAIAssistant() {
  const toggleAIBtn = document.getElementById("toggle-ai-assistant-btn");
  const aiSection = document.getElementById("ai-assistant-section");
  const askButton = document.getElementById("ai-ask-btn");
  const questionInput = document.getElementById("ai-question-input");
  const chatMessages = document.getElementById("ai-chat-messages");

  // Hiển thị nút kích hoạt trợ lý AI khi có dữ liệu cổ phiếu
  function showAIButton() {
    toggleAIBtn.classList.remove("hidden");
  }

  // Ẩn/hiện khu vực trợ lý AI
  toggleAIBtn.addEventListener("click", function() {
    aiSection.classList.toggle("hidden");
  });

  // Xử lý khi người dùng hỏi
  askButton.addEventListener("click", handleUserQuestion);
  questionInput.addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
      handleUserQuestion();
    }
  });

function handleUserQuestion() {
  const question = questionInput.value.trim();
  if (!question) return;

  // Hiển thị câu hỏi của người dùng
  const userMessageDiv = document.createElement("div");
  userMessageDiv.className = "ai-message user";
  userMessageDiv.textContent = question;
  chatMessages.appendChild(userMessageDiv);

  // Hiển thị trạng thái đang nhập
  const typingDiv = document.createElement("div");
  typingDiv.className = "ai-message";
  typingDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
  chatMessages.appendChild(typingDiv);
  
  // Cuộn xuống cuối cuộc trò chuyện
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // Xóa input
  questionInput.value = "";

  // Lấy dữ liệu cổ phiếu hiện tại
  const stockInfo = getStockData();
  
  // Sau một khoảng thời gian, hiển thị phản hồi của AI
  setTimeout(() => {
    chatMessages.removeChild(typingDiv);
    const aiMessageDiv = document.createElement("div");
    aiMessageDiv.className = "ai-message";
    aiMessageDiv.innerHTML = generateAIResponse(question, stockInfo);
    chatMessages.appendChild(aiMessageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 1500);
}

// Lấy dữ liệu cổ phiếu hiện tại
function getStockData() {
  const stockInfoElement = document.getElementById("stock-info");
  const stockInfo = {};

  try {
    // Lấy symbol
    const symbolText = stockInfoElement.querySelector("h2")?.textContent || "";
    stockInfo.symbol = symbolText;

    // Lấy tên công ty
    const companyNameElement = stockInfoElement.querySelector("p:nth-child(2)")?.textContent || "";
    stockInfo.companyName = companyNameElement.replace("Tên công ty:", "").trim();

    // Lấy giá hiện tại
    const priceElement = stockInfoElement.querySelector("p:nth-child(3)")?.textContent || "";
    const priceMatch = priceElement.match(/\$([0-9.]+)/);
    stockInfo.price = priceMatch ? parseFloat(priceMatch[1]) : 0;

    // Lấy thay đổi
    const changeElement = stockInfoElement.querySelector("p:nth-child(4)")?.textContent || "";
    const changeMatch = changeElement.match(/([+-]?[0-9.]+)/);
    stockInfo.change = changeMatch ? parseFloat(changeMatch[0]) : 0;

    // Lấy phần trăm thay đổi
    const percentageElement = stockInfoElement.querySelector("p:nth-child(5)")?.textContent || "";
    const percentageMatch = percentageElement.match(/([+-]?[0-9.]+)/);
    stockInfo.changePercent = percentageMatch ? parseFloat(percentageMatch[0]) : 0;

    // Lấy dữ liệu từ chart nếu có
    if (window.stockChart && window.stockChart.data) {
      stockInfo.chartData = {
        dates: [...window.stockChart.data.labels],
        prices: [...window.stockChart.data.datasets[0].data]
      };
    }
  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu cổ phiếu:", error);
  }

  return stockInfo;
}

// Tạo phản hồi từ AI dựa trên câu hỏi và dữ liệu cổ phiếu
function generateAIResponse(question, stockInfo) {
  question = question.toLowerCase();
  
  // Nếu không có dữ liệu cổ phiếu
  if (!stockInfo.symbol) {
    return "Vui lòng tìm kiếm một cổ phiếu trước khi hỏi về nó.";
  }

  // Phân tích xu hướng đơn giản từ dữ liệu biểu đồ
  let trend = "không xác định";
  let recommendation = "không có khuyến nghị cụ thể";
  let technicalAnalysis = "";

  if (stockInfo.chartData && stockInfo.chartData.prices.length > 5) {
    const prices = stockInfo.chartData.prices;
    const recentPrices = prices.slice(-5);
    
    // Phân tích xu hướng đơn giản
    let upDays = 0;
    for (let i = 1; i < recentPrices.length; i++) {
      if (recentPrices[i] > recentPrices[i-1]) upDays++;
    }
    
    if (upDays >= 3) {
      trend = "tăng";
      recommendation = "có thể xem xét mua vào nếu phù hợp với chiến lược đầu tư của bạn";
    } else if (upDays <= 1) {
      trend = "giảm";
      recommendation = "nên thận trọng và theo dõi thêm";
    } else {
      trend = "đi ngang";
      recommendation = "nên chờ tín hiệu rõ ràng hơn";
    }
    
    // Phân tích kỹ thuật đơn giản
    const lastPrice = prices[prices.length - 1];
    const ma5 = calculateMA(prices, 5);
    const ma10 = calculateMA(prices, 10);
    
    technicalAnalysis = `<br>- Giá hiện tại: $${lastPrice.toFixed(2)}<br>- MA5: $${ma5.toFixed(2)}<br>- MA10: $${ma10.toFixed(2)}`;
    
    if (lastPrice > ma5 && ma5 > ma10) {
      technicalAnalysis += "<br>- Chỉ báo: Xu hướng tăng trong ngắn hạn, giá trên đường trung bình động";
    } else if (lastPrice < ma5 && ma5 < ma10) {
      technicalAnalysis += "<br>- Chỉ báo: Xu hướng giảm trong ngắn hạn, giá dưới đường trung bình động";
    } else {
      technicalAnalysis += "<br>- Chỉ báo: Xu hướng chưa rõ ràng";
    }
  }

  // Các câu trả lời dựa trên loại câu hỏi
  if (question.includes("xu hướng") || question.includes("trend")) {
    return `Dựa trên dữ liệu gần đây, cổ phiếu ${stockInfo.symbol} (${stockInfo.companyName}) có xu hướng <strong>${trend}</strong>. Giá hiện tại là $${stockInfo.price}, với mức thay đổi ${stockInfo.change} (${stockInfo.changePercent}%).${technicalAnalysis}`;
  }
  else if (question.includes("nên đầu tư") || question.includes("nên mua") || question.includes("có nên mua")) {
    return `Dựa trên phân tích kỹ thuật đơn giản, <strong>${recommendation}</strong> đối với cổ phiếu ${stockInfo.symbol}. Lưu ý đây chỉ là phân tích sơ bộ, bạn nên tham khảo thêm các nguồn thông tin khác và phân tích cơ bản về công ty trước khi đưa ra quyết định đầu tư.${technicalAnalysis}`;
  }
  else if (question.includes("phân tích kỹ thuật") || question.includes("technical")) {
    return `Phân tích kỹ thuật cơ bản cho ${stockInfo.symbol}:${technicalAnalysis || "<br>Chưa có đủ dữ liệu để phân tích kỹ thuật."}`;
  }
  else if (question.includes("dự đoán") || question.includes("ngắn hạn")) {
    let prediction = "";
    
    if (trend === "tăng") {
      prediction = "tích cực";
    } else if (trend === "giảm") {
      prediction = "tiêu cực";
    } else {
      prediction = "chưa có tín hiệu rõ ràng";
    }
    
    return `Dự đoán ngắn hạn cho ${stockInfo.symbol} là <strong>${prediction}</strong>. Lưu ý rằng dự đoán này chỉ dựa trên phân tích kỹ thuật đơn giản và thị trường chứng khoán luôn tiềm ẩn rủi ro.${technicalAnalysis}`;
  }
  else {
    return `Tôi có thể giúp bạn phân tích cổ phiếu ${stockInfo.symbol} (${stockInfo.companyName}). Giá hiện tại là $${stockInfo.price}. Bạn có thể hỏi tôi về xu hướng, khuyến nghị đầu tư, phân tích kỹ thuật hoặc dự đoán ngắn hạn.`;
  }
}

// Tính toán đường trung bình động
function calculateMA(prices, period) {
  if (prices.length < period) return 0;
  
  const recentPrices = prices.slice(-period);
  const sum = recentPrices.reduce((total, price) => total + price, 0);
  return sum / period;
}

// Sửa đổi hàm getStockPrice để hiển thị nút AI khi có dữ liệu
const originalGetStockPrice = window.getStockPrice;
window.getStockPrice = function(...args) {
  const result = originalGetStockPrice.apply(this, args);
  
  // Sau khi lấy dữ liệu xong, hiển thị nút AI
  setTimeout(() => {
    showAIButton();
  }, 800);
    
    return result;
  };
}