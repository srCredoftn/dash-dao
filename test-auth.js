// Simple test to verify auth endpoints
async function testAuth() {
  try {
    console.log("Testing login...");
    const loginResponse = await fetch("http://localhost:3001/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@2snd.fr",
        password: "admin123",
      }),
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    console.log("✅ Login successful");
    console.log("User: [redacted-email]");
    console.log("Token length:", loginData.token.length);

    console.log("\nTesting /me endpoint...");
    const meResponse = await fetch("http://localhost:3001/api/auth/me", {
      headers: {
        Authorization: `Bearer ${loginData.token}`,
      },
    });

    if (!meResponse.ok) {
      const errorData = await meResponse.json();
      throw new Error(
        `/me failed: ${meResponse.status} - ${JSON.stringify(errorData)}`,
      );
    }

    const meData = await meResponse.json();
    console.log("✅ /me endpoint successful");
    console.log("User from /me: [redacted-email]");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testAuth();
