import './App.css'

function App() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">KitobHub</p>
        <h1>Onlayn kitob do‘koni</h1>
        <p className="description">
          Bu sahifa KitobHub frontend loyihasining boshlang‘ich React +
          TypeScript + Vite versiyasi.
        </p>
      </section>

      <section className="layout">
        <div className="content">
          <h2>Kitoblar</h2>
          <p>
            Keyingi bosqichda bu joyda catalog-service orqali keladigan
            kitoblar ro‘yxati ko‘rsatiladi.
          </p>
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
