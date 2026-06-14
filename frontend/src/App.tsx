import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { fetchBooks } from './api'
import type { Book } from './api'
import './App.css'

function formatPrice(price: string, currency: string) {
  return `${Number(price).toLocaleString('uz-UZ')} ${currency}`
}

function App() {
  const [books, setBooks] = useState<Book[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadBooks() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const data = await fetchBooks(activeSearch)

        if (isMounted) {
          setBooks(data.items)
          setTotal(data.total)
        }
      } catch {
        if (isMounted) {
          setErrorMessage(
            'Kitoblarni yuklashda xatolik yuz berdi. Backend ishlayotganini tekshiring.',
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadBooks()

    return () => {
      isMounted = false
    }
  }, [activeSearch])

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActiveSearch(search)
  }

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">KitobHub</p>
        <h1>Onlayn kitob do‘koni</h1>
        <p className="description">
          Frontend endi catalog-service API orqali PostgreSQL’dagi kitoblarni
          ko‘rsatadi.
        </p>
      </section>

      <section className="layout">
        <div className="content">
          <div className="section-header">
            <div>
              <h2>Kitoblar</h2>
              <p>{total} ta kitob topildi</p>
            </div>

            <form className="search-form" onSubmit={handleSearchSubmit}>
              <input
                type="search"
                placeholder="Kitob, muallif yoki kategoriya..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button type="submit">Qidirish</button>
            </form>
          </div>

          {isLoading && <p className="status">Kitoblar yuklanmoqda...</p>}

          {errorMessage && <p className="error">{errorMessage}</p>}

          {!isLoading && !errorMessage && books.length === 0 && (
            <p className="status">Hozircha kitob topilmadi.</p>
          )}

          {!isLoading && !errorMessage && books.length > 0 && (
            <div className="book-grid">
              {books.map((book) => (
                <article className="book-card" key={book.id}>
                  <div>
                    <p className="category">{book.category_name}</p>
                    <h3>{book.title}</h3>
                    <p className="author">{book.author_name}</p>
                    {book.description && (
                      <p className="book-description">{book.description}</p>
                    )}
                  </div>

                  <div className="book-footer">
                    <strong>{formatPrice(book.price, book.currency)}</strong>
                    <span>{book.stock_quantity} dona mavjud</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="tools-panel">
          <h2>Tools</h2>
          <p>Toshkent ob-havosi va valyuta kurslari keyin qo‘shiladi.</p>
        </aside>
      </section>
    </main>
  )
}

export default App
