export type Query = {
    graph: (query: unknown, options?: unknown) => Promise<any>
}

export type Promotion = {
    id?: string
    code?: string
}
