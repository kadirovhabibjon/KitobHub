import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import {
  createOrder,
  fetchBooks,
  fetchCurrencyRate,
  fetchOrders,
  fetchTashkentWeather,
} from './api'
import type { Book, CurrencyRate, Order, TashkentWeather } from './api'

type CartItem = {
  book: Book
  quantity: number
}

function formatPrice(price: string, currency: string) {
  return `${Number(price).toLocaleString('uz-UZ')} ${currency}`
}

function formatAmount(amount: number, currency: string) {
  return `${amount.toLocaleString('uz-UZ')} ${currency}`
}

function formatWeatherTime(value: string | null) {
  if (!value) {
    return 'Nomaʼlum'
  }

  return value.replace('T', ' ')
}

function App() {
  const [books, setBooks] = useState<Book[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [lastOrder, setLastOrder] = useState<Order | null>(null)
  const [failedImageIds, setFailedImageIds] = useState<number[]>([])
  const [currencyRate, setCurrencyRate] = useState<CurrencyRate | null>(null)
  const [weather, setWeather] = useState<TashkentWeather | null>(null)
  const [toolsLoading, setToolsLoading] = useState(true)
  const [toolsError, setToolsError] = useState<string | null>(null)

  const cartTotalAmount = cartItems.reduce(
    (total, item) => total + Number(item.book.price) * item.quantity,
    0,
  )
  const cartCurrency = cartItems[0]?.book.currency ?? 'UZS'

  async function loadBooks(searchValue = search) {
    try {
      setLoading(true)
      setError(null)

      const data = await fetchBooks(searchValue)
      setBooks(data.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kitoblarni yuklashda xatolik')
    } finally {
      setLoading(false)
    }
  }

  async function loadOrders() {
    try {
      setOrdersLoading(true)

      const data = await fetchOrders()
      setOrders(data.items)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Sotib olingan narsalarni yuklashda xatolik',
      )
    } finally {
      setOrdersLoading(false)
    }
  }

  async function loadTools() {
    try {
      setToolsLoading(true)
      setToolsError(null)

      const [currencyData, weatherData] = await Promise.all([
        fetchCurrencyRate('USD'),
        fetchTashkentWeather(),
      ])

      setCurrencyRate(currencyData)
      setWeather(weatherData)
    } catch (err) {
      setToolsError(
        err instanceof Error
          ? err.message
          : 'Valyuta va ob-havo maʼlumotlarini yuklashda xatolik',
      )
    } finally {
      setToolsLoading(false)
    }
  }

  useEffect(() => {
    void loadBooks('')
    void loadOrders()
    void loadTools()
  }, [])

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadBooks(search)
  }

  function handleAddToCart(book: Book) {
    if (book.stock_quantity <= 0) {
      setError('Bu kitob hozircha omborda yo‘q')
      return
    }

    setError(null)
    setSuccessMessage(null)

    setCartItems((items) => {
      const existing = items.find((item) => item.book.id === book.id)

      if (!existing) {
        return [...items, { book, quantity: 1 }]
      }

      if (existing.quantity >= book.stock_quantity) {
        setError('Karzinkadagi miqdor ombordagi miqdordan oshib ketmasligi kerak')
        return items
      }

      return items.map((item) =>
        item.book.id === book.id
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      )
    })
  }

  function handleChangeCartQuantity(bookId: number, change: number) {
    setCartItems((items) =>
      items
        .map((item) => {
          if (item.book.id !== bookId) {
            return item
          }

          const nextQuantity = item.quantity + change
          const safeQuantity = Math.min(
            Math.max(nextQuantity, 0),
            item.book.stock_quantity,
          )

          return { ...item, quantity: safeQuantity }
        })
        .filter((item) => item.quantity > 0),
    )
  }

  function handleRemoveFromCart(bookId: number) {
    setCartItems((items) => items.filter((item) => item.book.id !== bookId))
  }

  async function handleCheckout() {
    if (cartItems.length === 0) {
      setError('Karzinka bo‘sh')
      return
    }

    try {
      setCheckoutLoading(true)
      setError(null)
      setSuccessMessage(null)
      setLastOrder(null)

      const order = await createOrder({
        customer_name: 'Habibjon Kadirov',
        customer_email: 'habibjon@example.com',
        note: 'Cart checkout from frontend',
        items: cartItems.map((item) => ({
          book_id: item.book.id,
          quantity: item.quantity,
        })),
      })

      setLastOrder(order)
      setCartItems([])
      setSuccessMessage(
        `Order #${order.id} yaratildi: ${formatPrice(order.total_amount, order.currency)}`,
      )

      await Promise.all([loadBooks(search), loadOrders()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order yaratishda xatolik')
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">KitobHub</p>
          <h1>Onlayn kitob do‘koni</h1>
          <p className="subtitle">
            React frontend NGINX API Gateway orqali catalog, order va tools
            service bilan ishlayapti.
          </p>
        </div>

        <div className="gateway-card">
          <span>Gateway</span>
          <strong>localhost:8088/api</strong>
        </div>
      </section>

      <section className="tools-grid">
        <article className="tool-card">
          <div>
            <span className="tool-label">Valyuta integratsiyasi</span>
            <h2>USD kursi</h2>
          </div>

          {toolsLoading ? (
            <p className="muted">Yuklanmoqda...</p>
          ) : currencyRate ? (
            <>
              <strong>
                {Number(currencyRate.rate_to_uzs).toLocaleString('uz-UZ')} UZS
              </strong>
              <p>
                {currencyRate.currency_name} · {currencyRate.date} ·{' '}
                {currencyRate.source}
              </p>
            </>
          ) : (
            <p className="muted">Maʼlumot topilmadi</p>
          )}
        </article>

        <article className="tool-card">
          <div>
            <span className="tool-label">Ob-havo integratsiyasi</span>
            <h2>Toshkent</h2>
          </div>

          {toolsLoading ? (
            <p className="muted">Yuklanmoqda...</p>
          ) : weather ? (
            <>
              <strong>
                {weather.temperature} {weather.temperature_unit}
              </strong>
              <p>
                Shamol: {weather.wind_speed} {weather.wind_speed_unit} ·{' '}
                {formatWeatherTime(weather.time)} · {weather.source}
              </p>
            </>
          ) : (
            <p className="muted">Maʼlumot topilmadi</p>
          )}
        </article>

        {toolsError && <div className="alert alert-error">{toolsError}</div>}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Kitoblar</h2>
            <p>Kitobni tanlang va karzinkaga qo‘shing.</p>
          </div>

          <form className="search-form" onSubmit={handleSearch}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Kitob, muallif yoki kategoriya..."
            />
            <button type="submit">Qidirish</button>
          </form>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {successMessage && <div className="alert alert-success">{successMessage}</div>}

        {lastOrder && (
          <div className="order-summary">
            <strong>Oxirgi order:</strong>
            <span>#{lastOrder.id}</span>
            <span>{lastOrder.status}</span>
            <span>{formatPrice(lastOrder.total_amount, lastOrder.currency)}</span>
          </div>
        )}

        {loading ? (
          <p className="muted">Yuklanmoqda...</p>
        ) : (
          <div className="book-grid">
            {books.map((book) => (
              <article className="book-card" key={book.id}>
                <div className="book-cover">
                  {book.image_url && !failedImageIds.includes(book.id) ? (
                    <img
                      src={book.image_url}
                      alt={book.title}
                      onError={() =>
                        setFailedImageIds((ids) =>
                          ids.includes(book.id) ? ids : [...ids, book.id],
                        )
                      }
                    />
                  ) : (
                    <span>{book.title.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>

                <div className="book-content">
                  <p className="category">{book.category_name}</p>
                  <h3>{book.title}</h3>
                  <p className="description">{book.description ?? 'Tavsif yo‘q'}</p>

                  <div className="meta">
                    <span>{book.author_name}</span>
                    <span>Stock: {book.stock_quantity}</span>
                  </div>

                  <div className="card-footer">
                    <strong>{formatPrice(book.price, book.currency)}</strong>
                    <button
                      type="button"
                      onClick={() => handleAddToCart(book)}
                      disabled={book.stock_quantity <= 0}
                    >
                      {book.stock_quantity <= 0 ? 'Tugagan' : 'Karzinkaga qo‘shish'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="commerce-grid">
        <article className="panel">
          <div className="section-title">
            <div>
              <h2>Karzinka</h2>
              <p>Sotib olmoqchi bo‘lgan kitoblaringiz shu yerda turadi.</p>
            </div>
            <strong>{cartItems.length} ta mahsulot</strong>
          </div>

          {cartItems.length === 0 ? (
            <p className="muted">Karzinka hozircha bo‘sh.</p>
          ) : (
            <>
              <div className="cart-list">
                {cartItems.map((item) => (
                  <div className="cart-item" key={item.book.id}>
                    <div>
                      <strong>{item.book.title}</strong>
                      <p>
                        {formatPrice(item.book.price, item.book.currency)} · Stock:{' '}
                        {item.book.stock_quantity}
                      </p>
                    </div>

                    <div className="quantity-control">
                      <button
                        type="button"
                        onClick={() => handleChangeCartQuantity(item.book.id, -1)}
                      >
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleChangeCartQuantity(item.book.id, 1)}
                        disabled={item.quantity >= item.book.stock_quantity}
                      >
                        +
                      </button>
                    </div>

                    <button
                      className="link-button"
                      type="button"
                      onClick={() => handleRemoveFromCart(item.book.id)}
                    >
                      O‘chirish
                    </button>
                  </div>
                ))}
              </div>

              <div className="cart-actions">
                <strong>Jami: {formatAmount(cartTotalAmount, cartCurrency)}</strong>
                <button
                  type="button"
                  onClick={() => void handleCheckout()}
                  disabled={checkoutLoading}
                >
                  {checkoutLoading ? 'Sotib olinmoqda...' : 'Sotib olish'}
                </button>
              </div>
            </>
          )}
        </article>

        <article className="panel">
          <div className="section-title">
            <div>
              <h2>Sotib olinganlar</h2>
              <p>Oxirgi yaratilgan orderlar.</p>
            </div>
          </div>

          {ordersLoading ? (
            <p className="muted">Yuklanmoqda...</p>
          ) : orders.length === 0 ? (
            <p className="muted">Hali orderlar yo‘q.</p>
          ) : (
            <div className="order-list">
              {orders.slice(0, 5).map((order) => (
                <div className="order-card" key={order.id}>
                  <div className="order-card-header">
                    <strong>Order #{order.id}</strong>
                    <span>{order.status}</span>
                  </div>
                  <p>{formatPrice(order.total_amount, order.currency)}</p>
                  <ul>
                    {order.items.map((item) => (
                      <li key={item.id}>
                        {item.book_title} × {item.quantity}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  )
}

export default App
