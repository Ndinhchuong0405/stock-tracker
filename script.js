const apiKey = "d01udh9r01qt2u30skogd01udh9r01qt2u30skp0"; // API key của bạn từ Finnhub

async function getStockPrice() {
  const symbol = document.getElementById("symbol-input").value.trim().toUpperCase() || "AAPL";
  const stockInfo = document.getElementById("stock-info");

  try {
    // Lấy giá hiện tại
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
    const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`;

    const [quoteRes, profileRes] = await Promise.all([
      fetch(quoteUrl),
      fetch(profileUrl)
    ]);

    const quoteData = await quoteRes.json();
    const profileData = await profileRes.json();

    if (!quoteData.c || quoteData.c === 0) {
      stockInfo.innerHTML = `<p>Không lấy được dữ liệu, thử lại với mã khác.</p>`;
      return;
    }

    stockInfo.innerHTML = `
      <h2>${symbol}</h2>
      <p><strong>Tên công ty:</strong> ${profileData.name || "Không rõ"}</p>
      <p><strong>Giá hiện tại:</strong> $${quoteData.c.toFixed(2)}</p>
      <p><strong>Thay đổi:</strong> ${quoteData.d >= 0 ? "+" : ""}${quoteData.d.toFixed(2)} USD</p>
      <p><strong>Tỷ lệ thay đổi:</strong> ${quoteData.dp.toFixed(2)}%</p>
    `;
  } catch (error) {
    stockInfo.innerHTML = `<p>Đã xảy ra lỗi khi kết nối API.</p>`;
    console.error("Lỗi khi gọi Finnhub API:", error);
  }
}
