export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`Erro de API (${status})`);
  }
}
