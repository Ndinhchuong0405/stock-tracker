const apiKey = "demo";
let stockChart = null;
let currentSymbol = ""; // Lưu tạm mã đang xem để thêm yêu thích

async function getStockPrice() {
  const symbol = document.getElementById("symbol-input").value.trim().toUpperCase() || "MSFT";
  currentSymbol = symbol; // lưu lại để dùng cho nút "Thêm vào yêu thích"
  const stockInfo = document.getElementById("stock-info");
  const addFavBtn = document.getElementById("add-favorite-btn");

  try {
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

    document.getElementById("stockChart").style.display = "block";

  } catch (error) {
    stockInfo.innerHTML = `<p>Đã xảy ra lỗi khi kết nối API.</p>`;
    console.error("Lỗi kết nối:", error);
    document.getElementById("add-favorite-btn").style.display = "none";
  }
}

// Xử lý thêm vào danh sách yêu thích khi người dùng bấm nút
function addToFavorites() {
  const symbol = currentSymbol;
  if (!symbol) return;

  const favoriteList = document.getElementById("favorite-list");
  const existing = Array.from(favoriteList.children).some(li => li.dataset.symbol === symbol);
  if (!existing) {
    const li = document.createElement("li");
    li.dataset.symbol = symbol;

    const span = document.createElement("span");
    span.textContent = symbol;
    span.className = "favorite-symbol";
    span.onclick = () => getStockPriceFromFavorite(symbol);

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "❌";
    removeBtn.className = "remove-btn";
    removeBtn.onclick = () => li.remove();

    li.appendChild(span);
    li.appendChild(removeBtn);
    favoriteList.appendChild(li);
  }
}

// Cho phép tra cứu lại khi click vào mã yêu thích
function getStockPriceFromFavorite(symbol) {
  document.getElementById("symbol-input").value = symbol;
  getStockPrice();
}
