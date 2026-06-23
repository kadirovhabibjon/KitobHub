import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import {
  createBook,
  createOrder,
  deleteBook,
  fetchBooks,
  fetchCurrencyRate,
  fetchOrders,
  fetchTashkentWeather,
  fetchCurrentUser,
  loginUser,
  registerUser,
  updateBook,
  updateOrderStatus,
} from './api'
import type { AuthUser, Book, BookPayload, CurrencyRate, Order, OrderStatus, TashkentWeather } from './api'

type CartItem = {
  book: Book
  quantity: number
}

type Page = 'home' | 'book-detail' | 'favorites' | 'cart' | 'orders' | 'admin' | 'auth' | 'delivery' | 'pickup-points'
type OrderFormSource = 'buy-now' | 'cart' | null
type AuthMode = 'login' | 'register'

type PaymentMethod = 'cash' | 'card'
type SortOption = 'default' | 'price-asc' | 'price-desc' | 'title-asc'

type AuthForm = {
  full_name: string
  email: string
  password: string
}

const AUTH_TOKEN_STORAGE_KEY = 'kitobhub_auth_token'

const emptyAuthForm: AuthForm = {
  full_name: '',
  email: '',
  password: '',
}

type AdminBookForm = {
  title: string
  description: string
  price: string
  currency: string
  image_url: string
  stock_quantity: string
  author_name: string
  category_name: string
}

const emptyAdminBookForm: AdminBookForm = {
  title: '',
  description: '',
  price: '',
  currency: 'UZS',
  image_url: '',
  stock_quantity: '0',
  author_name: '',
  category_name: '',
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

function formatOrderStatus(status: string) {
  const labels: Record<string, string> = {
    pending: 'Kutilmoqda',
    accepted: 'Qabul qilindi',
    confirmed: 'Tasdiqlandi',
    shipping: 'Yetkazilmoqda',
    delivered: 'Yetkazildi',
    cancelled: 'Bekor qilindi',
  }

  return labels[status] ?? status
}

function getOrderStatusOptions(status: string): { value: OrderStatus; label: string }[] {
  const currentStatus = status as OrderStatus

  const optionsByStatus: Record<OrderStatus, { value: OrderStatus; label: string }[]> = {
    pending: [
      { value: 'pending', label: 'Kutilmoqda' },
      { value: 'accepted', label: 'Qabul qilindi' },
      { value: 'cancelled', label: 'Bekor qilindi' },
    ],
    accepted: [
      { value: 'accepted', label: 'Qabul qilindi' },
      { value: 'shipping', label: 'Yetkazilmoqda' },
      { value: 'cancelled', label: 'Bekor qilindi' },
    ],
    shipping: [
      { value: 'shipping', label: 'Yetkazilmoqda' },
      { value: 'delivered', label: 'Yetkazildi' },
      { value: 'cancelled', label: 'Bekor qilindi' },
    ],
    delivered: [{ value: 'delivered', label: 'Yetkazildi' }],
    cancelled: [{ value: 'cancelled', label: 'Bekor qilindi' }],
  }

  return optionsByStatus[currentStatus] ?? optionsByStatus.pending
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

const FAVORITE_BOOK_IDS_STORAGE_KEY = 'kitobhub-favorite-book-ids'

function readFavoriteBookIds() {
  try {
    const rawValue = window.localStorage.getItem(FAVORITE_BOOK_IDS_STORAGE_KEY)

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

function saveFavoriteBookIds(ids: number[]) {
  try {
    window.localStorage.setItem(
      FAVORITE_BOOK_IDS_STORAGE_KEY,
      JSON.stringify(ids),
    )
  } catch {
    // localStorage ishlamasa ham app to‘xtab qolmasin
  }
}

function App() {
  const [booksPage, setBooksPage] = useState(1)

  const [activePage, setActivePage] = useState<Page>('home')
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authForm, setAuthForm] = useState<AuthForm>(emptyAuthForm)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(() =>
    localStorage.getItem(AUTH_TOKEN_STORAGE_KEY),
  )
  const [authLoading, setAuthLoading] = useState(false)
  const isAdmin = authUser?.role === 'admin'
  const [books, setBooks] = useState<Book[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [visibleOrderIds, setVisibleOrderIds] = useState<number[]>(() => readVisibleOrderIds())
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [favoriteBookIds, setFavoriteBookIds] = useState<number[]>(() => readFavoriteBookIds())

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortOption, setSortOption] = useState<SortOption>('default')
  const [adminBookForm, setAdminBookForm] =
    useState<AdminBookForm>(emptyAdminBookForm)
  const [editingBookId, setEditingBookId] = useState<number | null>(null)
  const [adminLoading, setAdminLoading] = useState(false)
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

  const categoryOptions = useMemo(() => {
    return Array.from(new Set(books.map((book) => book.category_name))).sort(
      (firstCategory, secondCategory) =>
        firstCategory.localeCompare(secondCategory),
    )
  }, [books])

  const filteredBooks = useMemo(() => {
    const nextBooks = books.filter((book) => {
      const categoryMatches =
        categoryFilter === 'all' || book.category_name === categoryFilter
      return categoryMatches
    })

    return [...nextBooks].sort((firstBook, secondBook) => {
      if (sortOption === 'price-asc') {
        return Number(firstBook.price) - Number(secondBook.price)
      }

      if (sortOption === 'price-desc') {
        return Number(secondBook.price) - Number(firstBook.price)
      }

      if (sortOption === 'title-asc') {
        return firstBook.title.localeCompare(secondBook.title)
      }

      return firstBook.id - secondBook.id
    })
  }, [books, categoryFilter, sortOption])

  const BOOKS_PER_PAGE = 20
  const totalBookPages = Math.max(1, Math.ceil(filteredBooks.length / BOOKS_PER_PAGE))
  const safeBooksPage = Math.min(booksPage, totalBookPages)
  const paginatedBooks = filteredBooks.slice(
    (safeBooksPage - 1) * BOOKS_PER_PAGE,
    safeBooksPage * BOOKS_PER_PAGE,
  )

  function goToBooksPage(nextPage: number) {
    const next = Math.min(Math.max(nextPage, 1), totalBookPages)

    setBooksPage(next)

    window.setTimeout(() => {
      document.querySelector('.book-grid')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 0)
  }


  const favoriteBooks = useMemo(() => {
    const favoriteIdSet = new Set(favoriteBookIds)

    return books.filter((book) => favoriteIdSet.has(book.id))
  }, [books, favoriteBookIds])

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

  useEffect(() => {
    saveFavoriteBookIds(favoriteBookIds)
  }, [favoriteBookIds])

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActivePage('home')
    await loadBooks(search)
  }

  function isBookFavorite(bookId: number) {
    return favoriteBookIds.includes(bookId)
  }

  function handleToggleFavorite(book: Book) {
    setError(null)

    setFavoriteBookIds((ids) => {
      if (ids.includes(book.id)) {
        setSuccessMessage(`${book.title} sevimlilardan olib tashlandi`)
        return ids.filter((id) => id !== book.id)
      }

      setSuccessMessage(`${book.title} sevimlilarga qo‘shildi`)
      return [book.id, ...ids]
    })
  }

  function handleOpenBookDetail(book: Book) {
    setSelectedBook(book)
    setError(null)
    setSuccessMessage(null)
    setActivePage('book-detail')
  }

  function handleBackToBooks() {
    setSelectedBook(null)
    setError(null)
    setSuccessMessage(null)
    setActivePage('home')
  }


  useEffect(() => {
    if (!authToken) {
      setAuthUser(null)
      return
    }

    void restoreAuthUser(authToken)
  }, [authToken])

  function goToPage(page: Page) {
    if (page === 'admin' && !isAdmin) {
      setAuthMode('login')
      setActivePage('auth')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setError(null)
    setSuccessMessage(null)
    setSelectedBook(null)
    setActivePage(page)

    if (page === 'orders' || page === 'admin') {
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
        customer_phone: customerPhone.trim(),
        delivery_address: customerAddress.trim(),
        payment_method: paymentMethod,
        note: null,
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
      <section className="tools-grid home-tools-sidebar">
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

            <div className="sidebar-ad-stack" aria-label="Reklama va promolar">
              <article className="sidebar-ad-card sidebar-ad-card-featured">
                <span className="sidebar-ad-badge">SPONSORED</span>
                <h3>Haftaning kitobi</h3>
                <p>
                  Dasturchilar uchun eng ko‘p tavsiya qilinadigan kitoblarni
                  KitobHub orqali tez toping.
                </p>
                <div className="sidebar-ad-highlight">
                  <span>Promo</span>
                  <strong>KITOBHUB10</strong>
                </div>
              </article>

              <article className="sidebar-ad-card sidebar-video-card">
                <span className="sidebar-ad-badge">VIDEO AD</span>

                <details className="sidebar-video-player">
                  <summary className="sidebar-video-frame" aria-label="Kitob video reklamasini ko‘rish">
                    <div className="sidebar-video-cover">
                      <span className="sidebar-video-play">▶</span>
                    </div>
                    <span className="sidebar-video-time">00:45</span>
                  </summary>

                  <div className="sidebar-video-real sidebar-video-youtube">
                    <iframe
                      className="sidebar-video-iframe"
                      src="https://www.youtube-nocookie.com/embed/9P4ri-WCdDw?rel=0&modestbranding=1&autoplay=1&mute=1"
                      title="Kitob video reklamasi"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </details>

                <h3>Kitob video reklamasi</h3>
                <p>
                  Yangi kelgan kitoblar uchun qisqa trailer, promo video yoki
                  nashriyot reklamasini shu joyda ko‘rsatish mumkin.
                </p>

                <div className="sidebar-video-meta">
                  <span>Book trailer</span>
                  <strong>Demo integratsiya</strong>
                </div>
              </article>

              <article className="sidebar-ad-card sidebar-ad-card-mini">
                <span>🔥 Bugungi promo</span>
                <strong>Top kitoblarga chegirma</strong>
                <small>Demo reklama integratsiyasi</small>
              </article>
            </div>
      </section>
    )
  }

  function handleAdminBookFieldChange(
    field: keyof AdminBookForm,
    value: string,
  ) {
    setAdminBookForm((form) => ({
      ...form,
      [field]: value,
    }))
  }

  function handleStartCreateBook() {
    setEditingBookId(null)
    setAdminBookForm(emptyAdminBookForm)
    setError(null)
    setSuccessMessage(null)
  }

  function handleStartEditBook(book: Book) {
    setEditingBookId(book.id)
    setAdminBookForm({
      title: book.title,
      description: book.description ?? '',
      price: String(Number(book.price)),
      currency: book.currency,
      image_url: book.image_url ?? '',
      stock_quantity: String(book.stock_quantity),
      author_name: book.author_name,
      category_name: book.category_name,
    })
    setError(null)
    setSuccessMessage(null)
    setActivePage('admin')
  }

  function buildAdminBookPayload(): BookPayload | null {
    const title = adminBookForm.title.trim()
    const authorName = adminBookForm.author_name.trim()
    const categoryName = adminBookForm.category_name.trim()
    const currency = adminBookForm.currency.trim().toUpperCase() || 'UZS'
    const price = Number(adminBookForm.price)
    const stockQuantity = Number(adminBookForm.stock_quantity)

    if (!title) {
      setError('Kitob nomini kiriting')
      return null
    }

    if (!authorName) {
      setError('Muallif nomini kiriting')
      return null
    }

    if (!categoryName) {
      setError('Kategoriya nomini kiriting')
      return null
    }

    if (!Number.isFinite(price) || price <= 0) {
      setError('Narx 0 dan katta bo‘lishi kerak')
      return null
    }

    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      setError('Stock 0 yoki undan katta butun son bo‘lishi kerak')
      return null
    }

    if (currency.length !== 3) {
      setError('Valyuta 3 ta harfdan iborat bo‘lishi kerak, masalan UZS')
      return null
    }

    return {
      title,
      description: adminBookForm.description.trim() || null,
      price: String(price),
      currency,
      image_url: adminBookForm.image_url.trim() || null,
      stock_quantity: stockQuantity,
      author_name: authorName,
      category_name: categoryName,
    }
  }

  async function handleSubmitAdminBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payload = buildAdminBookPayload()
    if (!payload) {
      return
    }

    try {
      setAdminLoading(true)
      setError(null)
      setSuccessMessage(null)

      if (editingBookId) {
        const updatedBook = await updateBook(editingBookId, payload)

        setBooks((items) =>
          items.map((book) => (book.id === updatedBook.id ? updatedBook : book)),
        )

        if (selectedBook?.id === updatedBook.id) {
          setSelectedBook(updatedBook)
        }

        setSuccessMessage(`${updatedBook.title} tahrirlandi`)
      } else {
        const createdBook = await createBook(payload)

        setBooks((items) => [createdBook, ...items])
        setSuccessMessage(`${createdBook.title} qo‘shildi`)
      }

      setEditingBookId(null)
      setAdminBookForm(emptyAdminBookForm)
      await loadBooks(search)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Admin amalini bajarishda xatolik',
      )
    } finally {
      setAdminLoading(false)
    }
  }

  async function handleDeleteAdminBook(book: Book) {
    const confirmed = window.confirm(
      `${book.title} kitobini o‘chirishni xohlaysizmi?`,
    )

    if (!confirmed) {
      return
    }

    try {
      setAdminLoading(true)
      setError(null)
      setSuccessMessage(null)

      await deleteBook(book.id)

      setBooks((items) => items.filter((item) => item.id !== book.id))
      setFavoriteBookIds((ids) => ids.filter((id) => id !== book.id))
      setCartItems((items) => items.filter((item) => item.book.id !== book.id))

      if (selectedBook?.id === book.id) {
        setSelectedBook(null)
      }

      if (editingBookId === book.id) {
        setEditingBookId(null)
        setAdminBookForm(emptyAdminBookForm)
      }

      setSuccessMessage(`${book.title} o‘chirildi`)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Kitobni o‘chirishda xatolik',
      )
    } finally {
      setAdminLoading(false)
    }
  }

  async function handleAdminOrderStatusChange(
    orderId: number,
    newStatus: OrderStatus,
  ) {
    try {
      setAdminLoading(true)
      setError(null)
      setSuccessMessage(null)

      const updatedOrder = await updateOrderStatus(orderId, newStatus)

      setOrders((items) =>
        items.map((order) =>
          order.id === updatedOrder.id ? updatedOrder : order,
        ),
      )

      setLastOrder((order) =>
        order?.id === updatedOrder.id ? updatedOrder : order,
      )

      setSuccessMessage(
        `Order #${updatedOrder.id} statusi: ${formatOrderStatus(updatedOrder.status)}`,
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Order statusini o‘zgartirishda xatolik',
      )
    } finally {
      setAdminLoading(false)
    }
  }

  async function restoreAuthUser(token: string) {
    try {
      const user = await fetchCurrentUser(token)
      setAuthUser(user)
    } catch {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
      setAuthToken(null)
      setAuthUser(null)
    }
  }

  function handleAuthFieldChange(
    field: keyof AuthForm,
    value: string,
  ) {
    setAuthForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function switchAuthMode(mode: AuthMode) {
    setAuthMode(mode)
    setAuthForm(emptyAuthForm)
    setError(null)
    setSuccessMessage(null)
  }

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setAuthLoading(true)
      setError(null)
      setSuccessMessage(null)

      const response =
        authMode === 'login'
          ? await loginUser({
              email: authForm.email,
              password: authForm.password,
            })
          : await registerUser({
              full_name: authForm.full_name,
              email: authForm.email,
              password: authForm.password,
            })

      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.access_token)
      setAuthToken(response.access_token)
      setAuthUser(response.user)
      setAuthForm(emptyAuthForm)

      setSuccessMessage(
        response.user.role === 'admin'
          ? 'Admin sifatida tizimga kirdingiz'
          : 'Tizimga muvaffaqiyatli kirdingiz',
      )

      setActivePage(response.user.role === 'admin' ? 'admin' : 'home')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Tizimga kirishda xatolik yuz berdi',
      )
    } finally {
      setAuthLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    setAuthToken(null)
    setAuthUser(null)
    setSuccessMessage('Tizimdan chiqdingiz')
    setError(null)

    if (activePage === 'admin') {
      setActivePage('home')
    }
  }

  function renderAuthPage() {
    const isRegisterMode = authMode === 'register'

    return (
      <section className="auth-page">
        <div className="auth-card">
          <div className="section-eyebrow">ACCOUNT</div>
          <h2>{isRegisterMode ? 'Ro‘yxatdan o‘tish' : 'Tizimga kirish'}</h2>
          <p>
            {isRegisterMode
              ? 'Yangi account yarating. Birinchi yaratilgan user admin bo‘ladi.'
              : 'Admin panel va buyurtmalarni boshqarish uchun login qiling.'}
          </p>

          <div className="auth-tabs">
            <button
              type="button"
              className={!isRegisterMode ? 'active' : ''}
              onClick={() => switchAuthMode('login')}
            >
              Kirish
            </button>


            <button
              type="button"
              className={isRegisterMode ? 'active' : ''}
              onClick={() => switchAuthMode('register')}
            >
              Ro‘yxatdan o‘tish
            </button>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {isRegisterMode && (
              <label>
                <span>Ism familiya</span>
                <input
                  value={authForm.full_name}
                  onChange={(event) =>
                    handleAuthFieldChange('full_name', event.target.value)
                  }
                  placeholder="Habibjon Kadirov"
                  minLength={2}
                  required
                />
              </label>
            )}

            <label>
              <span>Email</span>
              <input
                value={authForm.email}
                onChange={(event) =>
                  handleAuthFieldChange('email', event.target.value)
                }
                placeholder="habibjonkadirovv@gmail.com"
                type="email"
                required
              />
            </label>

            <label>
              <span>Parol</span>
              <input
                value={authForm.password}
                onChange={(event) =>
                  handleAuthFieldChange('password', event.target.value)
                }
                placeholder="Kamida 6 ta belgi"
                type="password"
                minLength={6}
                required
              />
            </label>

            <button type="submit" className="primary-button" disabled={authLoading}>
              {authLoading
                ? 'Yuborilmoqda...'
                : isRegisterMode
                  ? 'Account yaratish'
                  : 'Kirish'}
            </button>
          </form>
        </div>

        <div className="auth-info-card">
          <h3>Demo admin</h3>
          <p>
            Siz yaratgan birinchi user admin:
            <strong> habibjonkadirovv@gmail.com</strong>
          </p>
          <p>
            Login qilingandan keyin yuqorida <strong>Admin</strong> tugmasi
            faqat admin userga ko‘rinadi.
          </p>
        </div>
      </section>
    )
  }

  function renderAdminPage() {
    return (
      <section className="panel admin-panel">
        <div className="page-title">
          <div>
            <p className="eyebrow">Admin panel</p>
            <h2>Kitoblar va buyurtmalar boshqaruvi</h2>
            <p>
              Kitob qo‘shish, tahrirlash, o‘chirish, stock va buyurtmalarni
              ko‘rish.
            </p>
          </div>

          <button type="button" onClick={handleStartCreateBook}>
            + Yangi kitob
          </button>
        </div>

        <div className="admin-layout">
          <form className="admin-form" onSubmit={handleSubmitAdminBook}>
            <h3>{editingBookId ? 'Kitobni tahrirlash' : 'Yangi kitob qo‘shish'}</h3>

            <label>
              Kitob nomi
              <input
                value={adminBookForm.title}
                onChange={(event) =>
                  handleAdminBookFieldChange('title', event.target.value)
                }
                placeholder="Masalan: Clean Architecture"
              />
            </label>

            <label>
              Tavsif
              <textarea
                value={adminBookForm.description}
                onChange={(event) =>
                  handleAdminBookFieldChange('description', event.target.value)
                }
                placeholder="Kitob haqida qisqa tavsif..."
              />
            </label>

            <div className="admin-form-grid">
              <label>
                Narx
                <input
                  value={adminBookForm.price}
                  onChange={(event) =>
                    handleAdminBookFieldChange('price', event.target.value)
                  }
                  placeholder="150000"
                  inputMode="decimal"
                />
              </label>

              <label>
                Valyuta
                <input
                  value={adminBookForm.currency}
                  onChange={(event) =>
                    handleAdminBookFieldChange('currency', event.target.value)
                  }
                  placeholder="UZS"
                  maxLength={3}
                />
              </label>

              <label>
                Stock
                <input
                  value={adminBookForm.stock_quantity}
                  onChange={(event) =>
                    handleAdminBookFieldChange(
                      'stock_quantity',
                      event.target.value,
                    )
                  }
                  placeholder="10"
                  inputMode="numeric"
                />
              </label>
            </div>

            <label>
              Rasm URL
              <input
                value={adminBookForm.image_url}
                onChange={(event) =>
                  handleAdminBookFieldChange('image_url', event.target.value)
                }
                placeholder="https://..."
              />
            </label>

            <div className="admin-form-grid two">
              <label>
                Muallif
                <input
                  value={adminBookForm.author_name}
                  onChange={(event) =>
                    handleAdminBookFieldChange('author_name', event.target.value)
                  }
                  placeholder="Robert C. Martin"
                />
              </label>

              <label>
                Kategoriya
                <input
                  value={adminBookForm.category_name}
                  onChange={(event) =>
                    handleAdminBookFieldChange(
                      'category_name',
                      event.target.value,
                    )
                  }
                  placeholder="Programming"
                />
              </label>
            </div>

            <div className="admin-form-actions">
              <button type="submit" disabled={adminLoading}>
                {adminLoading
                  ? 'Saqlanmoqda...'
                  : editingBookId
                    ? 'Saqlash'
                    : 'Kitob qo‘shish'}
              </button>

              {editingBookId && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handleStartCreateBook}
                >
                  Bekor qilish
                </button>
              )}
            </div>
          </form>

          <div className="admin-list">
            <div className="admin-section-header">
              <h3>Kitoblar</h3>
              <span>{books.length} ta</span>
            </div>

            {books.map((book) => (
              <article className="admin-book-card" key={book.id}>
                <div>
                  <strong>{book.title}</strong>
                  <p>
                    {book.author_name} · {book.category_name} ·{' '}
                    {formatPrice(book.price, book.currency)}
                  </p>
                  <p>Stock: {book.stock_quantity}</p>
                </div>

                <div className="admin-card-actions">
                  <button type="button" onClick={() => handleStartEditBook(book)}>
                    Tahrirlash
                  </button>

                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => void handleDeleteAdminBook(book)}
                    disabled={adminLoading}
                  >
                    O‘chirish
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="admin-orders">
          <div className="admin-section-header">
            <h3>Buyurtmalar</h3>
            <span>{orders.length} ta</span>
          </div>

          {ordersLoading ? (
            <p className="muted">Buyurtmalar yuklanmoqda...</p>
          ) : orders.length === 0 ? (
            <p className="muted">Hali buyurtmalar yo‘q.</p>
          ) : (
            <div className="admin-order-list">
              {orders.slice(0, 8).map((order) => (
                <article className="admin-order-card" key={order.id}>
                  <div>
                    <strong>Order #{order.id}</strong>
                    <p>
                      {order.customer_name} ·{' '}
                      {formatPrice(order.total_amount, order.currency)}
                    </p>
                    <p>
                      {order.customer_phone ?? 'Telefon yo‘q'} ·{' '}
                      {order.delivery_address ?? 'Manzil yo‘q'}
                    </p>
                  </div>

                  <div className="admin-status-control">
                    <span>{formatOrderStatus(order.status)}</span>
                    <select
                      value={order.status}
                      onChange={(event) =>
                        void handleAdminOrderStatusChange(
                          order.id,
                          event.target.value as OrderStatus,
                        )
                      }
                      disabled={adminLoading}
                    >
                      {getOrderStatusOptions(order.status).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    )
  }

  function renderBooksPage() {
    return (
      <>
        {renderTools()}

        <section className="panel home-books-main">
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

          <div className="filter-toolbar">
            <label className="filter-field">
              Kategoriya
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">Barchasi</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>


            <label className="filter-field">
              Saralash
              <select
                value={sortOption}
                onChange={(event) =>
                  setSortOption(event.target.value as SortOption)
                }
              >
                <option value="default">Standart</option>
                <option value="price-asc">Narx: arzonidan qimmatiga</option>
                <option value="price-desc">Narx: qimmatidan arzoniga</option>
                <option value="title-asc">Nomi bo‘yicha</option>
              </select>
            </label>

            <div className="result-counter">
              {paginatedBooks.length} / {filteredBooks.length} ta kitob
            </div>
          </div>

          {loading ? (
            <p className="muted">Yuklanmoqda...</p>
          ) : (
            <>
            <div className="book-grid book-grid-page-animate" key={safeBooksPage}>
              {renderMarketingShowcase()}
              {paginatedBooks.map((book) => (
                <article
                  className="book-card clickable-book-card"
                  key={book.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenBookDetail(book)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleOpenBookDetail(book)
                    }
                  }}
                >
                  <button
                    className={`favorite-button ${isBookFavorite(book.id) ? 'active' : ''}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleToggleFavorite(book)
                    }}
                    title={
                      isBookFavorite(book.id)
                        ? 'Sevimlilardan olib tashlash'
                        : 'Sevimlilarga qo‘shish'
                    }
                  >
                    {isBookFavorite(book.id) ? '♥' : '♡'}
                  </button>

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
                          onClick={(event) => {
                            event.stopPropagation()
                            handleBuyNow(book)
                          }}
                          disabled={book.stock_quantity <= 0 || orderLoading}
                        >
                          {book.stock_quantity <= 0
                            ? 'Tugagan'
                            : 'Hoziroq xarid qilish'}
                        </button>

                        <button
                          className="cart-icon-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleAddToCart(book)
                          }}
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

            {totalBookPages > 1 && (
              <div className="book-pagination-controls" aria-label="Kitoblar sahifalari">
                <button
                  type="button"
                  className="book-page-arrow book-page-arrow-left"
                  onClick={() => goToBooksPage(safeBooksPage - 1)}
                  disabled={safeBooksPage === 1}
                  aria-label="Oldingi sahifa"
                >
                  ‹
                </button>

                <div className="book-page-status">
                  <span>Sahifa</span>
                  <strong>{safeBooksPage} / {totalBookPages}</strong>
                </div>

                <button
                  type="button"
                  className="book-page-arrow book-page-arrow-right"
                  onClick={() => goToBooksPage(safeBooksPage + 1)}
                  disabled={safeBooksPage === totalBookPages}
                  aria-label="Keyingi sahifa"
                >
                  ›
                </button>
              </div>
            )}
            </>
          )}
        </section>
      </>
    )
  }



  function renderPickupPointsPage() {
    const pickupPoints = [
      {
        name: 'KitobHub Beruniy',
        address: 'Toshkent shahri, Olmazor tumani, Talabalar ko‘chasi 16D',
        time: '09:00–22:00, dam olish kunisiz',
        phone: '+998 90 610 64 55',
      },
      {
        name: 'KitobHub Kamolon',
        address: 'Toshkent shahri, Shayxontohur tumani, 1-Oltin yo‘li, 34',
        time: '09:00–22:00, dam olish kunisiz',
        phone: '+998 71 200 01 05',
      },
      {
        name: 'KitobHub Kitob Olami',
        address: 'Toshkent, Yunusobod tumani, Mustaqillik prospekti, 6',
        time: '10:00–23:00, dam olish kunisiz',
        phone: '+998 90 037 06 45',
      },
      {
        name: 'KitobHub Chilonzor',
        address: 'Toshkent shahri, Chilonzor tumani, Bunyodkor shoh ko‘chasi',
        time: '09:00–21:00',
        phone: '+998 93 777 20 20',
      },
    ]

    return (
      <section className="pickup-page">
        <div className="pickup-page-header">
          <div>
            <span className="pickup-breadcrumb">Bosh sahifa / Olib ketish punktlari</span>
            <h2>Olib ketish punktlari</h2>
          </div>

          <div className="pickup-tabs">
            <button type="button" className="active">Barcha viloyatlar</button>
            <button type="button">KitobHub</button>
            <button type="button">Toshkent</button>
            <button type="button">Hamkor punktlar</button>
          </div>
        </div>

        <div className="pickup-nearby-card">
          <div className="pickup-nearby-icon">📍</div>

          <div>
            <span>YANGI</span>
            <h3>Sizga yaqin punktlarni topish</h3>
            <p>
              Eng yaqin olib ketish punktlarini ko‘rsatamiz, shunda sizga qulay
              manzilni tanlash osonroq bo‘ladi.
            </p>
            <small>
              Joylashuv ma’lumotingiz faqat eng yaqin punktlarni aniqlash uchun
              ishlatiladi.
            </small>
          </div>

          <button type="button">Eng yaqin punktlarni ko‘rsatish →</button>
        </div>

        <div className="pickup-layout">
          <aside className="pickup-list-panel">
            <div className="pickup-search-box">
              <input type="text" placeholder="Qidirish" />
            </div>

            <div className="pickup-list">
              {pickupPoints.map((point) => (
                <article className="pickup-point-card" key={point.name}>
                  <div className="pickup-point-logo">A</div>

                  <div>
                    <h3>{point.name}</h3>
                    <p>📍 {point.address}</p>
                    <p>🕘 {point.time}</p>
                    <p>☎ {point.phone}</p>
                  </div>
                </article>
              ))}
            </div>
          </aside>

          <section className="pickup-map-panel" aria-label="Olib ketish punktlari xaritasi">
            <div className="pickup-map-toolbar">
              <button type="button">➤</button>
              <input type="text" placeholder="Adres yoki obyekt" />
              <button type="button" className="pickup-map-search">Topish</button>
            </div>

            <div className="pickup-map-canvas">
              <div className="pickup-map-road horizontal road-1" />
              <div className="pickup-map-road horizontal road-2" />
              <div className="pickup-map-road vertical road-3" />
              <div className="pickup-map-road vertical road-4" />

              {Array.from({ length: 28 }).map((_, index) => (
                <span
                  className="pickup-map-pin"
                  style={{
                    left: `${22 + ((index * 11) % 58)}%`,
                    top: `${28 + ((index * 17) % 48)}%`,
                  }}
                  key={index}
                >
                  A
                </span>
              ))}

              <div className="pickup-map-city city-one">Toshkent</div>
              <div className="pickup-map-city city-two">Chirchiq</div>
              <div className="pickup-map-city city-three">Yangiyo‘l</div>
            </div>
          </section>
        </div>
      </section>
    )
  }






  function renderMarketingShowcase() {
    return (
      <section className="home-promo-banner-section" aria-label="KitobHub promo banner">
        <article className="home-promo-banner">
          <div className="home-promo-content">
            <span className="home-promo-kicker">KITOBHUB PROMO</span>

            <h2>Yangi kitoblar mavsumi</h2>

            <p>
              Dasturlash, badiiy adabiyot va biznes kitoblarini bitta joydan tanlang.
              Eng kerakli kitoblar KitobHub’da sizni kutmoqda.
            </p>

            <button type="button" onClick={() => goToPage('home')}>
              Kitoblarni ko‘rish
            </button>
          </div>

          <div className="home-promo-visual" aria-hidden="true">
            <div className="home-promo-book main-book">CL</div>
            <div className="home-promo-book small-book one">SH</div>
            <div className="home-promo-book small-book two">HP</div>
          </div>
        </article>
      </section>
    )
  }

  function renderDeliveryPage() {
    return (
      <section className="delivery-page">
        <div className="delivery-hero-card">
          <span className="delivery-eyebrow">KitobHub yetkazib berish xizmati</span>
          <h2>Yetkazib berish</h2>
          <p>
            KitobHub orqali buyurtma qilingan kitoblar Toshkent shahri va hududlar
            bo‘ylab qulay, xavfsiz va tez yetkazib beriladi.
          </p>
        </div>

        <div className="delivery-content-card">
          <h1>1. “Eshikkacha” odatiy yetkazib berish</h1>

          <p>
            Toshkent shahri bo‘ylab buyurtmalar odatda 24–72 soat ichida
            yetkazib beriladi. Buyurtma holati o‘zgarganda mijozga xabar beriladi.
          </p>

          <p>
            Hududlarga yetkazib berish kuryerlik xizmati orqali amalga oshiriladi.
            Viloyat markazlariga buyurtmalar taxminan 2 ish kuni, tumanlarga esa
            5 ish kunigacha yetkazilishi mumkin.
          </p>

          <p>
            Buyurtma rasmiylashtirilayotganda telefon raqami, F.I.O. va yetkazib
            berish manzilini to‘g‘ri kiritish muhim. Kuryer yetib kelganda
            buyurtmani qabul qiluvchi shaxs ma’lumotlarni tasdiqlashi mumkin.
          </p>

          <div className="delivery-highlight-box">
            <strong>Toshkent shahri uchun:</strong>
            <span>
              1 000 000 so‘mgacha bo‘lgan buyurtmalar uchun yetkazib berish narxi
              30 000 so‘m. 1 000 000 so‘mdan yuqori buyurtmalar uchun yetkazib
              berish bepul bo‘lishi mumkin.
            </span>
          </div>

          <div className="delivery-highlight-box">
            <strong>Hududlar uchun:</strong>
            <span>
              Narx buyurtmaning vazni, o‘lchami, manzili va kuryerlik xizmatiga
              qarab belgilanadi.
            </span>
          </div>

          <ul className="delivery-list">
            <li>Viloyat markazlariga — 2 ish kuni ichida.</li>
            <li>Tumanlarga — 5 ish kunigacha.</li>
            <li>Buyurtma holatini “Buyurtmalar” bo‘limida kuzatish mumkin.</li>
          </ul>

          <div className="delivery-form-preview">
            <div className="delivery-form-header">Buyurtma rasmiylashtirish</div>

            <div className="delivery-form-grid">
              <label>
                Telefon
                <span>+998 90 123 45 67</span>
              </label>

              <label>
                F.I.O.
                <span>Habibjon Kadirov</span>
              </label>

              <label>
                Viloyat
                <span>Toshkent shahri</span>
              </label>

              <label>
                Shahar / Tuman
                <span>Chilonzor tumani</span>
              </label>
            </div>

            <div className="delivery-form-note">
              Yetkazib berish manzili checkout formasi orqali olinadi va
              order-service’da saqlanadi.
            </div>
          </div>
        </div>
      </section>
    )
  }

  function renderBookDetailPage() {
    if (!selectedBook) {
      return (
        <section className="panel">
          <div className="empty-state">
            <h3>Kitob tanlanmagan</h3>
            <p>Kitoblar bo‘limiga qaytib, biror kitobni tanlang.</p>
            <button type="button" onClick={handleBackToBooks}>
              Kitoblarga qaytish
            </button>
          </div>
        </section>
      )
    }

    const book = selectedBook

    return (
      <section className="panel detail-panel">
        <button className="back-button" type="button" onClick={handleBackToBooks}>
          ← Kitoblarga qaytish
        </button>

        <div className="book-detail-layout">
          <div className="book-detail-cover">
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

          <div className="book-detail-content">
            <p className="category">{book.category_name}</p>
            <h2>{book.title}</h2>

            <p className="book-detail-author">
              Muallif: <strong>{book.author_name}</strong>
            </p>

            <p className="book-detail-description">
              {book.description ?? 'Bu kitob uchun tavsif hali kiritilmagan.'}
            </p>

            <div className="detail-stats">
              <div>
                <span>Narx</span>
                <strong>{formatPrice(book.price, book.currency)}</strong>
              </div>

              <div>
                <span>Omborda</span>
                <strong>{book.stock_quantity} ta</strong>
              </div>

              <div>
                <span>Kategoriya</span>
                <strong>{book.category_name}</strong>
              </div>
            </div>

            <div className="detail-actions">
              <button
                type="button"
                onClick={() => handleBuyNow(book)}
                disabled={book.stock_quantity <= 0 || orderLoading}
              >
                {book.stock_quantity <= 0 ? 'Tugagan' : 'Hoziroq xarid qilish'}
              </button>

              <button
                className="detail-cart-button"
                type="button"
                onClick={() => handleAddToCart(book)}
                disabled={book.stock_quantity <= 0}
              >
                🛒 Savatchaga qo‘shish
              </button>

              <button
                className={`detail-favorite-button ${isBookFavorite(book.id) ? 'active' : ''}`}
                type="button"
                onClick={() => handleToggleFavorite(book)}
              >
                {isBookFavorite(book.id)
                  ? '♥ Sevimlilardan olish'
                  : '♡ Sevimlilarga qo‘shish'}
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  function renderFavoritesPage() {
    return (
      <section className="panel">
        <div className="page-title">
          <div>
            <p className="eyebrow">Sevimlilar</p>
            <h2>Yoqtirgan kitoblar</h2>
            <p>Yurakcha bosilgan kitoblar shu yerda saqlanadi.</p>
          </div>
          <strong>{favoriteBooks.length} ta kitob</strong>
        </div>

        {favoriteBooks.length === 0 ? (
          <div className="empty-state">
            <h3>Sevimlilar hali bo‘sh</h3>
            <p>Kitoblar bo‘limiga qaytib, yurakcha orqali kitob qo‘shing.</p>
            <button type="button" onClick={() => goToPage('home')}>
              Kitoblarga qaytish
            </button>
          </div>
        ) : (
          <div className="favorites-list">
            {favoriteBooks.map((book) => (
              <article className="favorite-card" key={book.id}>
                <div className="favorite-card-cover">
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

                <div>
                  <p className="category">{book.category_name}</p>
                  <h3>{book.title}</h3>
                  <p>{book.author_name}</p>
                  <strong>{formatPrice(book.price, book.currency)}</strong>
                </div>

                <div className="favorite-card-actions">
                  <button type="button" onClick={() => handleOpenBookDetail(book)}>
                    Batafsil
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBuyNow(book)}
                    disabled={book.stock_quantity <= 0 || orderLoading}
                  >
                    Xarid qilish
                  </button>

                  <button
                    className="detail-cart-button"
                    type="button"
                    onClick={() => handleAddToCart(book)}
                    disabled={book.stock_quantity <= 0}
                  >
                    🛒 Savatcha
                  </button>

                  <button
                    className="remove-favorite-button"
                    type="button"
                    onClick={() => handleToggleFavorite(book)}
                  >
                    ♥ Olib tashlash
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
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

                                <div className="order-note">
                  {order.customer_phone && <p>Telefon: {order.customer_phone}</p>}
                  {order.delivery_address && <p>Manzil: {order.delivery_address}</p>}
                  <p>To‘lov turi: {formatPaymentMethod(order.payment_method === 'card' ? 'card' : 'cash')}</p>
                  {order.note && <p>Izoh: {order.note}</p>}
                </div>
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
          className={activePage === 'home' || activePage === 'book-detail' ? 'active' : ''}
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

        <button
          className={activePage === 'favorites' ? 'active' : ''}
          type="button"
          onClick={() => goToPage('favorites')}
        >
          ♥ Sevimlilar <span>{favoriteBookIds.length}</span>
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
      

            {isAdmin && (
              <button
                className={activePage === 'admin' ? 'active' : ''}
                onClick={() => goToPage('admin')}
              >
                Admin
              </button>
            )}

            {authUser ? (
              <div className="auth-user-chip">
                <span>{authUser.full_name}</span>
                <small>{authUser.role === 'admin' ? 'Admin' : 'User'}</small>
                <button type="button" onClick={handleLogout}>
                  Chiqish
                </button>
              </div>
            ) : (
              <button
                className={activePage === 'auth' ? 'active' : ''}
                onClick={() => goToPage('auth')}
              >
                Kirish
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

      {activePage === 'pickup-points' && renderPickupPointsPage()}
      {activePage === 'delivery' && renderDeliveryPage()}
      {activePage === 'home' && renderBooksPage()}
      {activePage === 'book-detail' && renderBookDetailPage()}
      {activePage === 'favorites' && renderFavoritesPage()}
      {activePage === 'cart' && renderCartPage()}
      {activePage === 'orders' && renderOrdersPage()}
      {activePage === 'auth' && renderAuthPage()}
        {activePage === 'admin' && renderAdminPage()}
    
      <footer className="site-footer">
        <section className="footer-benefits" aria-label="KitobHub afzalliklari">
          <div className="footer-benefits-card">
            <article className="footer-benefit-item">
              <span className="footer-benefit-icon">📦</span>
              <div>
                <h3>Endi bozorlarga borishga hojat yo‘q</h3>
                <p>KitobHub orqali kitoblarni tez va qulay buyurtma qiling.</p>
              </div>
            </article>

            <button type="button" className="footer-benefit-item footer-benefit-button" onClick={() => goToPage('delivery')}>
              <span className="footer-benefit-icon">🚚</span>
              <div>
                <h3>Tez yetkazib berish</h3>
                <p>Buyurtmalar qisqa vaqt ichida manzilingizga yetkaziladi.</p>
              </div>
            </button>

            <article className="footer-benefit-item">
              <span className="footer-benefit-icon">💳</span>
              <div>
                <h3>Qulay to‘lov</h3>
                <p>Naqd yoki karta orqali to‘lov qilish imkoniyati mavjud.</p>
              </div>
            </article>

            <article className="footer-benefit-item">
              <span className="footer-benefit-icon">🛡️</span>
              <div>
                <h3>KitobHub kafolati</h3>
                <p>Sifatli xizmat, xavfsiz buyurtma va ishonchli savdo.</p>
              </div>
            </article>
          </div>
        </section>

        <section className="footer-main">
          <div className="footer-grid">
            <div className="footer-column">
              <h3>KitobHub haqida</h3>
              <a href="#">Biz haqimizda</a>
              <a href="#">KitobHub jamoasi</a>
              <a href="#">Litsenziya va guvohnoma</a>
              <a href="#">Hamkorlik</a>
              <a href="#">Biz bilan aloqa</a>
            </div>

            <div className="footer-column">
              <h3>Mijozlar uchun</h3>
              <a href="#">Ko‘p so‘raladigan savollar</a>
              <a href="#">Buyurtma holatini kuzatish</a>
              <a href="#">Ommaviy oferta</a>
              <a href="#">Qaytarish shartlari</a>
              <button type="button" className="footer-link-button" onClick={() => goToPage('delivery')}>Yetkazib berish tartibi</button>
            </div>

            <div className="footer-column">
              <h3>Ma’lumotlar</h3>
              <a href="#">Kategoriyalar</a>
              <a href="#">Yangiliklar</a>
              <a href="#">Blog</a>
              <a href="#">KitobHub Ads</a>
              <a href="#">Sayt xaritasi</a>
            </div>

            <div className="footer-column footer-delivery">
              <h3>Yetkazib berish va do‘konlar</h3>
              <button type="button">🏬 Bizning do‘konlar <span>›</span></button>
              <button type="button" onClick={() => goToPage('pickup-points')}>📍 Olib ketish punktlari <span>›</span></button>
              <button type="button" onClick={() => goToPage('delivery')}>🚚 Yetkazib berish <span>›</span></button>
            </div>

            <div className="footer-column footer-contact">
              <h3>Biz bilan aloqa</h3>
              <a href="tel:+998971200105">📞 +998 97 120 01 05</a>
              <a href="mailto:info@kitobhub.uz">✉️ info@kitobhub.uz</a>
              <a href="#">✈️ Telegram bot</a>
              <p>📍 Toshkent shahri, KitobHub demo ofisi</p>
            </div>
          </div>

          <div className="footer-bottom-row">
            <div>
              <h3>To‘lov turlari</h3>
              <div className="footer-payment-list">
                <span>💳 UZCARD</span>
                <span>💳 HUMO</span>
                <span>Payme</span>
                <span>Uzum</span>
                <span>Click</span>
                <span>Paynet</span>
              </div>
            </div>

            <div className="footer-social">
              <h3>Biz ijtimoiy tarmoqlarda</h3>
              <div>
                <a href="#">f</a>
                <a href="#">tg</a>
                <a href="#">ig</a>
                <a href="#">yt</a>
              </div>
            </div>
          </div>

          <div className="footer-copyright">
            <p>
              2026 © KitobHub. Online kitob do‘koni demo portfolio loyihasi.
              Barcha huquqlar himoyalangan.
            </p>
          </div>
        </section>

        <button type="button" className="footer-chat-button" aria-label="Chat orqali bog‘lanish">
          💬
        </button>
      </footer>

</main>
  )
}

export default App