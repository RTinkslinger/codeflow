import { AuthService } from './auth.js'
import { Router } from './router.js'
import { EventBus } from './events.js'
export class App {
  constructor(private auth: AuthService, private router: Router, private events: EventBus) {}
}
