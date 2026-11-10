import { mountApp, showStartupError } from "./app/mount";

mountApp().catch(showStartupError);
