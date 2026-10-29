for (const path of ['/admin', '/carrinho', '/busca', '/checkout']) {
  const res = await fetch('http://127.0.0.1:3457' + path, { redirect: 'manual' })
  const loc = res.headers.get('location')
  console.log(res.status, path, loc || '')
}
