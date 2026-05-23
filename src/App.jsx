import { useMemo, useState, useEffect } from 'react'
import './App.css'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const apiSymbolMap = {
  RELIANCE: 'RELIANCE.BSE',
  TCS: 'TCS.BSE',
  INFY: 'INFY.BSE',
  SBIN: 'SBIN.BSE',
  HDFCBANK: 'HDFCBANK.BSE',
  ICICIBANK: 'ICICIBANK.BSE',
}

const stockData = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', price: 2456.8, change: 1.25 },
  { symbol: 'TCS', name: 'Tata Consultancy', price: 3892.45, change: -0.45 },
  { symbol: 'INFY', name: 'Infosys Ltd', price: 1523.6, change: 0.89 },
  { symbol: 'SBIN', name: 'State Bank', price: 612.3, change: -1.12 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', price: 1645.2, change: 0.56 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', price: 945.75, change: -0.78 },
]

const holdingsData = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', qty: 50, avg: 2350.0, ltp: 2456.8, chg: 1.25, val: 122840, pnl: 5340 },
  { symbol: 'TCS', name: 'Tata Consultancy', qty: 25, avg: 3750.0, ltp: 3892.45, chg: -0.45, val: 97311, pnl: 3561 },
  { symbol: 'INFY', name: 'Infosys Ltd', qty: 100, avg: 1450.0, ltp: 1523.6, chg: 0.89, val: 152360, pnl: 7360 },
  { symbol: 'SBIN', name: 'State Bank of India', qty: 200, avg: 580.0, ltp: 612.3, chg: -1.12, val: 122460, pnl: 6460 },
]

const positionsData = [
  { symbol: 'RELIANCE', type: 'Buy', qty: 50, avg: 2440.0, ltp: 2456.8, chg: 0.68, pnl: 840 },
  { symbol: 'INFY', type: 'Sell', qty: 50, avg: 1510.0, ltp: 1523.6, chg: 0.9, pnl: 680 },
  { symbol: 'TCS', type: 'Buy', qty: 25, avg: 3850.0, ltp: 3892.45, chg: 1.1, pnl: 1061 },
]

const ordersData = [
  { orderId: 'ORD-001', symbol: 'RELIANCE', type: 'Buy', qty: 10, price: 2445.0, status: 'Executed', time: '10:30:25' },
  { orderId: 'ORD-002', symbol: 'INFY', type: 'Sell', qty: 25, price: 1520.0, status: 'Executed', time: '11:15:42' },
  { orderId: 'ORD-003', symbol: 'TCS', type: 'Buy', qty: 15, price: 3875.0, status: 'Pending', time: '13:20:10' },
  { orderId: 'ORD-004', symbol: 'SBIN', type: 'Sell', qty: 50, price: 615.0, status: 'Cancelled', time: '14:45:30' },
]

const sectionTitle = {
  holdings: 'Holdings',
  positions: 'Positions',
  orders: 'Order History',
}

function App() {
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [selectedSection, setSelectedSection] = useState('holdings')
  const [stocks, setStocks] = useState(stockData)
  const [liveError, setLiveError] = useState('')
  const [isFetching, setIsFetching] = useState(false)

  const apiKey = import.meta.env.VITE_ALPHA_VANTAGE_KEY?.trim()
  const refreshInterval = 60000

  const totalValue = stocks.reduce((sum, item) => {
    const holding = holdingsData.find((holdingItem) => holdingItem.symbol === item.symbol)
    const qty = holding ? holding.qty : 0
    return sum + item.price * qty
  }, 0)

  const totalPnl = stocks.reduce((sum, item) => {
    const holding = holdingsData.find((holdingItem) => holdingItem.symbol === item.symbol)
    if (!holding) return sum
    return sum + (item.price - holding.avg) * holding.qty
  }, 0)

  const latestHoldingsData = holdingsData.map((item) => {
    const live = stocks.find((stock) => stock.symbol === item.symbol)
    const price = live ? live.price : item.ltp
    const change = live ? live.change : item.chg
    const value = Math.round(price * item.qty)
    const pnl = Math.round((price - item.avg) * item.qty)
    return { ...item, ltp: price, chg: change, val: value, pnl }
  })

  const latestPositionsData = positionsData.map((item) => {
    const live = stocks.find((stock) => stock.symbol === item.symbol)
    return {
      ...item,
      ltp: live ? live.price : item.ltp,
      chg: live ? live.change : item.chg,
    }
  })

  const fetchQuote = async (symbol) => {
    const apiSymbol = apiSymbolMap[symbol]
    if (!apiSymbol) {
      throw new Error(`Unsupported symbol: ${symbol}`)
    }

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${apiSymbol}&apikey=${apiKey}`
    const response = await fetch(url)
    const data = await response.json()

    if (data.Note) {
      throw new Error('Alpha Vantage rate limit reached. Please wait a minute.')
    }

    const quote = data['Global Quote'] || {}
    const price = parseFloat(quote['05. price'])
    const rawChange = quote['10. change percent'] ?? ''
    const change = parseFloat(rawChange.replace('%', ''))

    if (Number.isNaN(price)) {
      throw new Error('Live quote unavailable for ' + symbol)
    }

    return { symbol, price, change: Number.isNaN(change) ? 0 : change }
  }

  const fetchMarketQuotes = async () => {
    if (!apiKey) {
      setLiveError('Add a free Alpha Vantage API key to .env: VITE_ALPHA_VANTAGE_KEY=your_key')
      return
    }

    setIsFetching(true)
    setLiveError('')

    try {
      const results = await Promise.all(
        stockData.map((item) => fetchQuote(item.symbol).catch((error) => ({ symbol: item.symbol, error }))),
      )

      const nextStocks = stockData.map((item) => {
        const updated = results.find((result) => result.symbol === item.symbol)
        if (updated && !updated.error) {
          return { ...item, price: updated.price, change: updated.change }
        }
        return item
      })

      setStocks(nextStocks)
    } catch (error) {
      setLiveError(error.message || 'Unable to fetch live market data')
    } finally {
      setIsFetching(false)
    }
  }

  useEffect(() => {
    if (!loggedIn) return

    fetchMarketQuotes()
    const intervalId = setInterval(fetchMarketQuotes, refreshInterval)
    return () => clearInterval(intervalId)
  }, [loggedIn])

  const chartData = useMemo(
    () => ({
      labels: stocks.map((stock) => stock.symbol),
      datasets: [
        {
          label: 'LTP',
          data: stocks.map((stock) => stock.price),
          borderColor: '#ff7a45',
          backgroundColor: '#ff7a45',
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    }),
    [stocks],
  )

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Market Watch Prices' },
      },
      scales: {
        x: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(203,213,225,0.08)' } },
        y: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(203,213,225,0.08)' } },
      },
    }),
    [],
  )

  function login() {
    if (userId.trim() && password.trim()) {
      setLoggedIn(true)
    } else {
      window.alert('Please enter a valid User ID and Password')
    }
  }

  function logout() {
    setLoggedIn(false)
    setUserId('')
    setPassword('')
    setSelectedSection('holdings')
  }

  return (
    <div className="app-root">
      {loggedIn ? (
        <div className="app-shell">
          <header className="topbar">
            <div className="brand">Kite UI React</div>
            <div className="topbar-right">
              <span>Welcome, {userId}</span>
              <button className="secondary-btn" onClick={logout}>
                Logout
              </button>
            </div>
          </header>

          <div className="layout">
            <aside className="sidebar">
              <div className="search-block">
                <input
                  className="search-input"
                  placeholder="Search market..."
                  aria-label="Search stocks"
                />
              </div>
              <div className="watch-header">Market Watch</div>
              <div className="watch-list">
                {stocks.map((stock) => (
                  <div key={stock.symbol} className="stock-item">
                    <div>
                      <div className="stock-name">{stock.symbol}</div>
                      <div className="stock-symbol">{stock.name}</div>
                    </div>
                    <div className="stock-price">
                      <div>₹{stock.price.toFixed(2)}</div>
                      <div className={`stock-change ${stock.change >= 0 ? 'positive' : 'negative'}`}>
                        {stock.change >= 0 ? '▲' : '▼'} {Math.abs(stock.change).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            <main className="main-panel">
              <div className="panel-header">
                <div>
                  <h1>{sectionTitle[selectedSection]}</h1>
                  <p>Track your positions, orders, and live market data.</p>
                </div>
                <div className="section-tabs">
                  {Object.keys(sectionTitle).map((section) => (
                    <button
                      key={section}
                      className={`tab-btn ${selectedSection === section ? 'active' : ''}`}
                      onClick={() => setSelectedSection(section)}
                    >
                      {sectionTitle[section]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="summary-cards">
                <div className="card summary-card">
                  <span>Total value</span>
                  <strong>₹{Math.round(totalValue).toLocaleString()}</strong>
                </div>
                <div className="card summary-card">
                  <span>Total P&L</span>
                  <strong className={totalPnl >= 0 ? 'positive' : 'negative'}>
                    ₹{Math.round(totalPnl).toLocaleString()}
                  </strong>
                </div>
                <div className="card summary-card">
                  <span>Positions</span>
                  <strong>{positionsData.length}</strong>
                </div>
              </div>

              <div className="chart-card">
                {liveError ? (
                  <div className="live-alert">{liveError}</div>
                ) : null}
                {isFetching ? <div className="live-alert">Refreshing live quotes...</div> : null}
                <Line data={chartData} options={chartOptions} />
              </div>

              <div className="table-card">
                {selectedSection === 'holdings' && (
                  <table>
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Qty</th>
                        <th>Avg</th>
                        <th>LTP</th>
                        <th>Change</th>
                        <th>Value</th>
                        <th>P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestHoldingsData.map((item) => (
                        <tr key={item.symbol}>
                          <td>{item.symbol}</td>
                          <td>{item.qty}</td>
                          <td>₹{item.avg.toFixed(2)}</td>
                          <td>₹{item.ltp.toFixed(2)}</td>
                          <td className={item.chg >= 0 ? 'positive' : 'negative'}>
                            {item.chg >= 0 ? '+' : ''}{item.chg.toFixed(2)}%
                          </td>
                          <td>₹{item.val.toLocaleString()}</td>
                          <td className={item.pnl >= 0 ? 'positive' : 'negative'}>₹{item.pnl.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {selectedSection === 'positions' && (
                  <table>
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>Avg</th>
                        <th>LTP</th>
                        <th>Change</th>
                        <th>P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestPositionsData.map((item) => (
                        <tr key={`${item.symbol}-${item.type}`}>
                          <td>{item.symbol}</td>
                          <td>
                            <span className={`order-pill ${item.type === 'Buy' ? 'buy' : 'sell'}`}>
                              {item.type}
                            </span>
                          </td>
                          <td>{item.qty}</td>
                          <td>₹{item.avg.toFixed(2)}</td>
                          <td>₹{item.ltp.toFixed(2)}</td>
                          <td className={item.chg >= 0 ? 'positive' : 'negative'}>
                            {item.chg >= 0 ? '+' : ''}{item.chg.toFixed(2)}%
                          </td>
                          <td className={item.pnl >= 0 ? 'positive' : 'negative'}>₹{item.pnl.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {selectedSection === 'orders' && (
                  <table>
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Symbol</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersData.map((order) => (
                        <tr key={order.orderId}>
                          <td>{order.orderId}</td>
                          <td>{order.symbol}</td>
                          <td>
                            <span className={`order-pill ${order.type === 'Buy' ? 'buy' : 'sell'}`}>
                              {order.type}
                            </span>
                          </td>
                          <td>{order.qty}</td>
                          <td>₹{order.price.toFixed(2)}</td>
                          <td>{order.status}</td>
                          <td>{order.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </main>
          </div>
        </div>
      ) : (
        <div className="login-page">
          <div className="login-card">
            <div className="login-title">Login to Kite UI</div>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Phone or User ID"
              className="login-input"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="login-input"
            />
            <button className="primary-btn" onClick={login}>
              Login
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
