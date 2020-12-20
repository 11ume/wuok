import { IncomingMessage } from 'http'
import { Context, Receive } from 'wezi-types'
import { parseJSON } from './utils'
import { parseBody } from './buffer'
import { Options as GetRawBodyOptions } from 'raw-body'
import contentType from 'content-type'

export const json = toJson()
export const buffer = toBuffer()

export const createReceive = (context: Context): Receive => {
    return {
        json: <T>(options?: GetRawBodyOptions) => json<T>(context, options)
        , text: (options?: GetRawBodyOptions) => text(context, options)
        , buffer: (options?: GetRawBodyOptions) => buffer(context, options)
    }
}

export const text = (context: Context, options?: GetRawBodyOptions) => buffer(context, options)
    .then((body) => body.toString())

export function toBuffer() {
    // avoid to read multiple times same stream object
    const rawBodyCache: WeakMap<IncomingMessage, Buffer> = new WeakMap()
    return async (context: Context, { limit = '1mb', encoding }: GetRawBodyOptions = {}): Promise<Buffer> => {
        const body = rawBodyCache.get(context.req)
        const type = context.req.headers['content-type'] || 'text/plain'
        const length = context.req.headers['content-length']

        if (body) return Promise.resolve(body)
        if (encoding === undefined) {
            const parameters = contentType.parse(type)?.parameters
            const b = await parseBody({
                context
                , limit
                , length
                , encoding: parameters?.charset
                , rawBodyCache
            })

            if (Buffer.isBuffer(b)) {
                return b
            }

            return null
        }

        const b = await parseBody({
            context
            , limit
            , length
            , encoding
            , rawBodyCache
        })

        if (Buffer.isBuffer(b)) {
            return b
        }

        return null
    }
}

export function toJson() {
    // avoid re-interpreting json
    const cacheJson: WeakMap<IncomingMessage, unknown> = new WeakMap()
    return <T>(context: Context, options?: GetRawBodyOptions): Promise<T> => buffer(context, options)
        .then((rawBody) => {
            const cached = cacheJson.get(context.req)
            if (cached) return cached

            const str = rawBody.toString()
            const body = parseJSON(str)
            cacheJson.set(context.req, body)
            return body
        })
}

