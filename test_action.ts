import { submitQuoteRequest } from './src/lib/actions';
async function test() {
  const result = await submitQuoteRequest({
    name: "Test User 2", phone: "0987654321", message: "Test product inquiry", products: [{product_id: 1, quantity: 1}]
  });
  console.log("Result:", result);
}
test();
