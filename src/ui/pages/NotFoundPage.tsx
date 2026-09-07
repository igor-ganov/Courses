import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 44 }}>
      <h1>Такой страницы нет</h1>
      <p className="muted" style={{ maxWidth: '46ch', margin: '0 auto 20px' }}>
        Возможно, материал ещё не написан или ссылка устарела. Карта курса всегда покажет, что доступно сейчас.
      </p>
      <Link className="btn btn--primary" to="/">
        На главную
      </Link>
    </div>
  );
}
