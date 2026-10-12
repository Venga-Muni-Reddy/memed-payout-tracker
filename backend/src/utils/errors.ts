/** Error that carries an HTTP status so the global error handler can respond correctly. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}
