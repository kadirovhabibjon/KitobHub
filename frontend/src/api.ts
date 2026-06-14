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

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8001'

export async function fetchBooks(search?: string): Promise<BookListResponse> {
  const params = new URLSearchParams()
  const normalizedSearch = search?.trim()

  if (normalizedSearch) {
    params.set('search', normalizedSearch)
  }

  const queryString = params.toString()
  const url = `${API_BASE_URL}/books${queryString ? `?${queryString}` : ''}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch books: ${response.status}`)
  }

  return response.json()
}
