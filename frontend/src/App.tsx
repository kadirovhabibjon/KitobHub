import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { createOrder, fetchBooks, fetchCurrencyRate, fetchTashkentWeather } from './api'
import type { Book, CurrencyRate, Order, TashkentWeather } from './api'

function formatPrice(price: string, currency: string) {
  return `${Number(price).toLocaleString('uz-UZ')} ${currency}`
}

function formatWeatherTime(value: string | null) {
  if (!value) {
    return 'Nomaʼlum'
  }

  return value.replace('T', ' ')
}

function App() {
  const [books, setBooks] = useState<Book[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [orderLoadingBookId, setOrderLoadingBookId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [lastOrder, setLastOrder] = useState<Order | null>(null)
  const [failedImageIds, setFailedImageIds] = useState<number[]>([])
  const [currencyRate, setCurrencyRate] = useState<CurrencyRate | null>(null)
  const [weather, setWeather] = useState<TashkentWeather | null>(null)
  const [toolsLoading, setToolsLoading] = useState(true)
  const [toolsError, setToolsError] = useState<string | null>(null)

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
    void loadTools()
  }, [])

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadBooks(search)
  }

  async function handleCreateOrder(book: Book) {
    try {
      setOrderLoadingBookId(book.id)
      setError(null)
      setSuccessMessage(null)
      setLastOrder(null)

      const order = await createOrder({
        customer_name: 'Habibjon Kadirov',
        customer_email: 'habibjon@example.com',
        note: 'Frontend order test',
        items: [
          {
            book_id: book.id,
            quantity: 1,
          },
        ],
      })

      setLastOrder(order)
      setSuccessMessage(
        `Order #${order.id} yaratildi: ${formatPrice(order.total_amount, order.currency)}`,
      )

      await loadBooks(search)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order yaratishda xatolik')
    } finally {
      setOrderLoadingBookId(null)
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">KitobHub</p>
          <h1>Onlayn kitob do‘koni</h1>
          <p className="subtitle">
            React frontend endi NGINX API Gateway orqali catalog va order
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
            <p>Kitobni tanlang va frontend orqali order yarating.</p>
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
                  <p className="description">{book.description}</p>

                  <div className="meta">
                    <span>{book.author_name}</span>
                    <span>Stock: {book.stock_quantity}</span>
                  </div>

                  <div className="card-footer">
                    <strong>{formatPrice(book.price, book.currency)}</strong>
                    <button
                      type="button"
                      onClick={() => void handleCreateOrder(book)}
                      disabled={
                        book.stock_quantity <= 0 || orderLoadingBookId === book.id
                      }
                    >
                      {orderLoadingBookId === book.id
                        ? 'Yaratilmoqda...'
                        : 'Buyurtma berish'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default App
