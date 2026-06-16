const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8088/api'

export type Book = {
  id: number
  title: string
  description: string | null
  price: string
  currency: string
  image_url: string | null
  stock_quantity: number
  author_id: number
  author_name: string
  category_id: number
  category_name: string
}

export type BookListResponse = {
  items: Book[]
  total: number
}

export type BookPayload = {
  title: string
  description?: string | null
  price: string
  currency: string
  image_url?: string | null
  stock_quantity: number
  author_name: string
  category_name: string
}

export type OrderItem = {
  id: number
  book_id: number
  book_title: string
  unit_price: string
  quantity: number
  line_total: string
}

export type Order = {
  id: number
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  delivery_address: string | null
  payment_method: string
  status: string
  total_amount: string
  currency: string
  note: string | null
  created_at: string
  updated_at: string
  items: OrderItem[]
}

export type OrderListResponse = {
  items: Order[]
  total: number
}

export type CreateOrderRequest = {
  customer_name: string
  customer_email?: string
  customer_phone?: string
  delivery_address?: string
  payment_method?: 'cash' | 'card'
  note?: string | null
  items: {
    book_id: number
    quantity: number
  }[]
}

export type CurrencyRate = {
  source: string
  currency: string
  currency_name: string
  rate_to_uzs: string
  date: string
}

export type TashkentWeather = {
  source: string
  city: string
  temperature: number | null
  temperature_unit: string | null
  wind_speed: number | null
  wind_speed_unit: string | null
  time: string | null
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(options?.headers)

  if (options?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null)
    const message =
      typeof errorPayload?.detail === 'string'
        ? errorPayload.detail
        : errorPayload?.detail?.message ??
          errorPayload?.message ??
          `Request failed with status ${response.status}`

    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export async function fetchBooks(search?: string): Promise<BookListResponse> {
  const params = new URLSearchParams()

  if (search) {
    params.set('search', search)
  }

  const query = params.toString()
  return request<BookListResponse>(`/books${query ? `?${query}` : ''}`)
}

export async function createBook(data: BookPayload): Promise<Book> {
  return request<Book>('/books', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateBook(
  bookId: number,
  data: Partial<BookPayload>,
): Promise<Book> {
  return request<Book>(`/books/${bookId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteBook(bookId: number): Promise<void> {
  return request<void>(`/books/${bookId}`, {
    method: 'DELETE',
  })
}

export async function fetchOrders(): Promise<OrderListResponse> {
  return request<OrderListResponse>('/orders')
}

export async function createOrder(data: CreateOrderRequest): Promise<Order> {
  return request<Order>('/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function fetchCurrencyRate(
  currency = 'USD',
): Promise<CurrencyRate> {
  const params = new URLSearchParams({ currency })

  return request<CurrencyRate>(`/tools/currency/rates?${params.toString()}`)
}

export async function fetchTashkentWeather(): Promise<TashkentWeather> {
  return request<TashkentWeather>('/tools/weather/tashkent')
}

export type OrderStatus = 'pending' | 'accepted' | 'shipping' | 'delivered' | 'cancelled'

export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus,
): Promise<Order> {
  return request<Order>(`/orders/${orderId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}
