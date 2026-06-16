import { useEffect, useMemo, useState } from 'react'
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

type Page = 'home' | 'cart' | 'orders'
type OrderFormSource = 'buy-now' | 'cart' | null
type PaymentMethod = 'cash' | 'card'

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

function formatOrderStatus(status: string) {
  const labels: Record<string, string> = {
    pending: 'Kutilmoqda',
    confirmed: 'Tasdiqlandi',
    delivered: 'Yetkazildi',
    cancelled: 'Bekor qilindi',
  }

  return labels[status] ?? status
}

function formatPaymentMethod(method: PaymentMethod) {
  return method === 'card' ? 'Karta orqali' : 'Naqd'
}

function getItemsTotal(items: CartItem[]) {
  return items.reduce(
    (total, item) => total + Number(item.book.price) * item.quantity,
    0,
  )
}

const VISIBLE_ORDER_IDS_STORAGE_KEY = 'kitobhub-visible-order-ids'

function readVisibleOrderIds() {
  try {
    const rawValue = window.localStorage.getItem(VISIBLE_ORDER_IDS_STORAGE_KEY)

    if (!rawValue) {
      return []
    }

    const parsedValue = JSON.parse(rawValue)

    if (!Array.isArray(parsedValue)) {
      return []
    }

    return parsedValue.filter((value): value is number => typeof value === 'number')
  } catch {
    return []
  }
}

function saveVisibleOrderIds(ids: number[]) {
  try {
    window.localStorage.setItem(
      VISIBLE_ORDER_IDS_STORAGE_KEY,
      JSON.stringify(ids),
    )
  } catch {
    // localStorage ishlamasa ham app to‘xtab qolmasin
  }
}

function App() {
  const [activePage, setActivePage] = useState<Page>('home')
  const [books, setBooks] = useState<Book[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [visibleOrderIds, setVisibleOrderIds] = useState<number[]>(() => readVisibleOrderIds())
  const [cartItems, setCartItems] = useState<CartItem[]>([])

  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [orderLoading, setOrderLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [lastOrder, setLastOrder] = useState<Order | null>(null)

  const [failedImageIds, setFailedImageIds] = useState<number[]>([])
  const [currencyRate, setCurrencyRate] = useState<CurrencyRate | null>(null)
  const [weather, setWeather] = useState<TashkentWeather | null>(null)
  const [toolsLoading, setToolsLoading] = useState(true)
  const [toolsError, setToolsError] = useState<string | null>(null)

  const [orderFormOpen, setOrderFormOpen] = useState(false)
  const [orderFormItems, setOrderFormItems] = useState<CartItem[]>([])
  const [orderFormSource, setOrderFormSource] = useState<OrderFormSource>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')

  const cartTotalQuantity = cartItems.reduce(
    (total, item) => total + item.quantity,
    0,
  )
  const cartTotalAmount = getItemsTotal(cartItems)
  const cartCurrency = cartItems[0]?.book.currency ?? 'UZS'

  const orderFormTotalAmount = getItemsTotal(orderFormItems)
  const orderFormCurrency = orderFormItems[0]?.book.currency ?? 'UZS'

  const visibleOrders = useMemo(() => {
    const idSet = new Set(visibleOrderIds)
    const filteredOrders = orders.filter((order) => idSet.has(order.id))

    if (lastOrder && !filteredOrders.some((order) => order.id === lastOrder.id)) {
      return [lastOrder, ...filteredOrders]
    }

    return filteredOrders
  }, [lastOrder, orders, visibleOrderIds])

  const shouldShowOrdersNav = visibleOrders.length > 0

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
          : 'Buyurtmalarni yuklashda xatolik',
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

  useEffect(() => {
    saveVisibleOrderIds(visibleOrderIds)
  }, [visibleOrderIds])

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActivePage('home')
    await loadBooks(search)
  }

  function goToPage(page: Page) {
    setError(null)
    setSuccessMessage(null)
    setActivePage(page)

    if (page === 'orders') {
      void loadOrders()
    }
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

    setSuccessMessage(`${book.title} savatchaga qo‘shildi`)
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

  function handleCancelCart() {
    setCartItems([])
    setError(null)
    setSuccessMessage('Karzinka tozalandi')
  }

  function openOrderForm(items: CartItem[], source: OrderFormSource) {
    setError(null)
    setSuccessMessage(null)
    setOrderFormItems(items)
    setOrderFormSource(source)
    setOrderFormOpen(true)
  }

  function closeOrderForm() {
    if (orderLoading) {
      return
    }

    setOrderFormOpen(false)
    setOrderFormItems([])
    setOrderFormSource(null)
  }

  function handleBuyNow(book: Book) {
    if (book.stock_quantity <= 0) {
      setError('Bu kitob hozircha omborda yo‘q')
      return
    }

    openOrderForm([{ book, quantity: 1 }], 'buy-now')
  }

  function handleCartCheckout() {
    if (cartItems.length === 0) {
      setError('Karzinka bo‘sh')
      return
    }

    openOrderForm(cartItems, 'cart')
  }

  async function handleConfirmOrder() {
    if (orderFormItems.length === 0) {
      setError('Buyurtma uchun mahsulot tanlanmagan')
      return
    }

    if (!customerName.trim()) {
      setError('Ism familiyani kiriting')
      return
    }

    if (!customerPhone.trim()) {
      setError('Telefon raqamni kiriting')
      return
    }

    if (!customerAddress.trim()) {
      setError('Uy manzili yoki lokatsiyani kiriting')
      return
    }

    try {
      setOrderLoading(true)
      setError(null)
      setSuccessMessage(null)

      const order = await createOrder({
        customer_name: customerName.trim(),
        note: [
          `Telefon: ${customerPhone.trim()}`,
          `Manzil: ${customerAddress.trim()}`,
          `To‘lov turi: ${formatPaymentMethod(paymentMethod)}`,
        ].join(' | '),
        items: orderFormItems.map((item) => ({
          book_id: item.book.id,
          quantity: item.quantity,
        })),
      })

      setLastOrder(order)
      setVisibleOrderIds((ids) =>
        ids.includes(order.id) ? ids : [order.id, ...ids],
      )
      setOrders((items) => [
        order,
        ...items.filter((item) => item.id !== order.id),
      ])

      if (orderFormSource === 'cart') {
        setCartItems((items) =>
          items.filter(
            (item) =>
              !orderFormItems.some(
                (orderItem) => orderItem.book.id === item.book.id,
              ),
          ),
        )
      }

      setSuccessMessage(
        `Order #${order.id} yaratildi: ${formatPrice(
          order.total_amount,
          order.currency,
        )}`,
      )

      setOrderFormOpen(false)
      setOrderFormItems([])
      setOrderFormSource(null)
      setActivePage('orders')

      await Promise.all([loadBooks(search), loadOrders()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order yaratishda xatolik')
    } finally {
      setOrderLoading(false)
    }
  }

  function renderTools() {
    return (
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
    )
  }

  function renderBooksPage() {
    return (
      <>
        {renderTools()}

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Kitoblar</h2>
              <p>Kitobni tanlang, darhol sotib oling yoki savatchaga qo‘shing.</p>
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

                    <div className="product-actions">
                      <strong>{formatPrice(book.price, book.currency)}</strong>

                      <div>
                        <button
                          className="buy-now-button"
                          type="button"
                          onClick={() => handleBuyNow(book)}
                          disabled={book.stock_quantity <= 0 || orderLoading}
                        >
                          {book.stock_quantity <= 0
                            ? 'Tugagan'
                            : 'Hoziroq xarid qilish'}
                        </button>

                        <button
                          className="cart-icon-button"
                          type="button"
                          onClick={() => handleAddToCart(book)}
                          disabled={book.stock_quantity <= 0}
                          title="Savatchaga qo‘shish"
                        >
                          🛒
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </>
    )
  }

  function renderCartPage() {
    return (
      <section className="panel">
        <div className="page-title">
          <div>
            <p className="eyebrow">Savatcha</p>
            <h2>Karzinka</h2>
            <p>Sotib olmoqchi bo‘lgan kitoblaringiz shu yerda turadi.</p>
          </div>
          <strong>{cartTotalQuantity} ta mahsulot</strong>
        </div>

        {cartItems.length === 0 ? (
          <div className="empty-state">
            <h3>Karzinka hozircha bo‘sh</h3>
            <p>Kitoblar bo‘limiga qaytib, mahsulot qo‘shing.</p>
            <button type="button" onClick={() => goToPage('home')}>
              Kitoblarga qaytish
            </button>
          </div>
        ) : (
          <div className="cart-page-layout">
            <div className="cart-list">
              {cartItems.map((item) => (
                <div className="cart-item cart-page-item" key={item.book.id}>
                  <div className="cart-preview">
                    <div className="mini-cover">
                      {item.book.title.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <strong>{item.book.title}</strong>
                      <p>
                        {formatPrice(item.book.price, item.book.currency)} · Stock:{' '}
                        {item.book.stock_quantity}
                      </p>
                    </div>
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

            <aside className="checkout-summary">
              <h3>Buyurtma xulosasi</h3>
              <p>Savatchadagi mahsulotlar soni: {cartTotalQuantity}</p>
              <strong>Jami: {formatAmount(cartTotalAmount, cartCurrency)}</strong>

              <button
                type="button"
                onClick={handleCartCheckout}
                disabled={orderLoading}
              >
                {orderLoading ? 'Yaratilmoqda...' : 'Buyurtma berish'}
              </button>

              <button
                className="cart-clear-button"
                type="button"
                onClick={handleCancelCart}
              >
                Bekor qilish
              </button>
            </aside>
          </div>
        )}
      </section>
    )
  }

  function renderOrdersPage() {
    return (
      <section className="panel">
        <div className="page-title">
          <div>
            <p className="eyebrow">Buyurtmalar</p>
            <h2>Sotib olinganlar</h2>
            <p>Oxirgi bergan buyurtmalaringiz shu yerda ko‘rinadi.</p>
          </div>
          <button type="button" onClick={() => void loadOrders()}>
            Yangilash
          </button>
        </div>

        {ordersLoading ? (
          <p className="muted">Yuklanmoqda...</p>
        ) : visibleOrders.length === 0 ? (
          <p className="muted">Hali buyurtma berilmadi.</p>
        ) : (
          <div className="order-list order-page-list">
            {visibleOrders.map((order) => (
              <div className="order-card" key={order.id}>
                <div className="order-card-header">
                  <strong>Order #{order.id}</strong>
                  <span>{formatOrderStatus(order.status)}</span>
                </div>

                <p>{formatPrice(order.total_amount, order.currency)}</p>

                <ul>
                  {order.items.map((item) => (
                    <li key={item.id}>
                      {item.book_title} × {item.quantity}
                    </li>
                  ))}
                </ul>

                {order.note && <p className="order-note">{order.note}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    )
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

      <nav className="shop-nav">
        <button
          className={activePage === 'home' ? 'active' : ''}
          type="button"
          onClick={() => goToPage('home')}
        >
          Kitoblar
        </button>

        <button
          className={activePage === 'cart' ? 'active' : ''}
          type="button"
          onClick={() => goToPage('cart')}
        >
          🛒 Savatcha <span>{cartTotalQuantity}</span>
        </button>

        {shouldShowOrdersNav && (
          <button
            className={activePage === 'orders' ? 'active' : ''}
            type="button"
            onClick={() => goToPage('orders')}
          >
            Buyurtmalar
          </button>
        )}
      </nav>

      {error && <div className="alert alert-error global-alert">{error}</div>}

      {successMessage && (
        <div className="alert alert-success global-alert">{successMessage}</div>
      )}

      {lastOrder && (
        <div className="order-summary">
          <strong>Oxirgi order:</strong>
          <span>#{lastOrder.id}</span>
          <span>{formatOrderStatus(lastOrder.status)}</span>
          <span>{formatPrice(lastOrder.total_amount, lastOrder.currency)}</span>
        </div>
      )}

      {orderFormOpen && (
        <div className="order-modal-backdrop">
          <form
            className="order-modal"
            onSubmit={(event) => {
              event.preventDefault()
              void handleConfirmOrder()
            }}
          >
            <div className="order-modal-header">
              <div>
                <p className="eyebrow">Buyurtma</p>
                <h2>Ma’lumotlarni kiriting</h2>
              </div>

              <button type="button" onClick={closeOrderForm}>
                ×
              </button>
            </div>

            <div className="order-form-products">
              {orderFormItems.map((item) => (
                <div className="order-form-product" key={item.book.id}>
                  <span>
                    {item.book.title} × {item.quantity}
                  </span>
                  <strong>
                    {formatAmount(
                      Number(item.book.price) * item.quantity,
                      item.book.currency,
                    )}
                  </strong>
                </div>
              ))}
            </div>

            <label>
              Ism familiya
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Masalan: Habibjon Kadirov"
              />
            </label>

            <label>
              Telefon raqam
              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="+998 90 123 45 67"
              />
            </label>

            <label>
              Uy manzili yoki lokatsiya
              <textarea
                value={customerAddress}
                onChange={(event) => setCustomerAddress(event.target.value)}
                placeholder="Masalan: Toshkent sh., Chilonzor, 12-kvartal..."
              />
            </label>

            <div className="payment-options">
              <span>To‘lov turi</span>

              <label>
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'cash'}
                  onChange={() => setPaymentMethod('cash')}
                />
                Naqd
              </label>

              <label>
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                />
                Karta
              </label>
            </div>

            <div className="order-modal-total">
              <span>Jami</span>
              <strong>{formatAmount(orderFormTotalAmount, orderFormCurrency)}</strong>
            </div>

            <button type="submit" disabled={orderLoading}>
              {orderLoading ? 'Yaratilmoqda...' : 'Buyurtma berish'}
            </button>
          </form>
        </div>
      )}

      {activePage === 'home' && renderBooksPage()}
      {activePage === 'cart' && renderCartPage()}
      {activePage === 'orders' && renderOrdersPage()}
    </main>
  )
}

export default App