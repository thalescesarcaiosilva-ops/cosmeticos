import { NextResponse } from 'next/server'

export function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(
    { error: true, message, ...(code ? { code } : {}) },
    { status }
  )
}

export function jsonSuccess<T>(data: T, message?: string, status = 200) {
  return NextResponse.json(
    { error: false, data, ...(message ? { message } : {}) },
    { status }
  )
}
