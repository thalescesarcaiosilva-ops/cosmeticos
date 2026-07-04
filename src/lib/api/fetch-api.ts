type ApiSuccess<T> = { error: false; data: T; message?: string }
type ApiFailure = { error: true; message: string; code?: string }

export async function fetchApi<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null; message: string | null }> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    const json = (await res.json()) as ApiSuccess<T> | ApiFailure

    if ('error' in json && json.error) {
      return { data: null, error: json.message, message: null }
    }

    const success = json as ApiSuccess<T>
    return { data: success.data, error: null, message: success.message ?? null }
  } catch {
    return { data: null, error: 'Algo deu errado, tente novamente', message: null }
  }
}
