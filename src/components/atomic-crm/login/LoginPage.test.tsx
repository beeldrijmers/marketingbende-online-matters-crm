import { CoreAdminContext, memoryStore, type AuthProvider } from "ra-core";
import fakeDataProvider from "ra-data-fakerest";
import { MemoryRouter } from "react-router";
import { render } from "vitest-browser-react";

import { testI18nProvider } from "../providers/commons/i18nProvider";
import { LoginPage } from "./LoginPage";

const renderLoginPage = async (login: AuthProvider["login"]) => {
  const authProvider: AuthProvider = {
    canAccess: async () => true,
    checkAuth: async () => undefined,
    checkError: async () => undefined,
    getIdentity: async () => ({ id: 1 }),
    login,
    logout: async () => undefined,
  };

  return render(
    <MemoryRouter>
      <CoreAdminContext
        authProvider={authProvider}
        dataProvider={fakeDataProvider({})}
        i18nProvider={testI18nProvider}
        store={memoryStore()}
      >
        <LoginPage />
      </CoreAdminContext>
    </MemoryRouter>,
  );
};

describe("LoginPage", () => {
  it("lets the user reveal and hide the password", async () => {
    const screen = await renderLoginPage(async () => undefined);
    const password = screen.getByLabelText("Password *");

    await expect.element(password).toHaveAttribute("type", "password");
    await expect
      .element(password)
      .toHaveAttribute("autocomplete", "current-password");

    await screen.getByRole("button", { name: "Show password" }).click();

    await expect.element(password).toHaveAttribute("type", "text");
    await screen.getByRole("button", { name: "Hide password" }).click();
    await expect.element(password).toHaveAttribute("type", "password");
  });

  it("shows a clear pending state while signing in", async () => {
    let finishLogin: (() => void) | undefined;
    const login = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishLogin = resolve;
        }),
    );
    const screen = await renderLoginPage(login);

    await screen.getByLabelText("Email *").fill("team@example.com");
    await screen.getByLabelText("Password *").fill("test-password");
    await screen.getByRole("button", { name: "Sign in" }).click();

    const pendingButton = screen.getByRole("button", { name: "Signing in..." });
    await expect.element(pendingButton).toBeDisabled();
    await expect.element(screen.getByLabelText("Email *")).toBeDisabled();
    await expect.element(screen.getByLabelText("Password *")).toBeDisabled();
    expect(login).toHaveBeenCalledWith({
      email: "team@example.com",
      password: "test-password",
    });

    finishLogin?.();
  });
});
