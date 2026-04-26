export async function fetchData(endpoint: string): Promise<unknown> {
  return fetch(endpoint).then(r => r.json())
}
