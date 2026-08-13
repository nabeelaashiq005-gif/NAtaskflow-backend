// Every successful response from our API follows this same shape,
// so the frontend always knows what to expect:
// { success: true, statusCode, data, message }
class ApiResponse {
  constructor(statusCode, data, message = "Success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}

export default ApiResponse;
