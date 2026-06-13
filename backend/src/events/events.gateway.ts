import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

const room = (userId: string) => `user:${userId}`;

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Authenticate the handshake and isolate each user into their own room so events
  // never leak between accounts.
  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    try {
      const payload = this.jwtService.verify(token ?? '', {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      const userId = payload.sub as string;
      client.data.userId = userId;
      client.join(room(userId));
    } catch {
      this.logger.warn(`Socket ${client.id} rejected: invalid/expired token`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    // Rooms are cleaned up automatically on disconnect.
  }

  emitNewTransaction(transaction: any) {
    this.server.to(room(String(transaction.userId))).emit('new_transaction', transaction);
  }

  emitTransactionUpdated(transaction: any) {
    this.server.to(room(String(transaction.userId))).emit('transaction_updated', transaction);
  }

  emitTransactionDeleted(id: string, userId: string) {
    this.server.to(room(userId)).emit('transaction_deleted', { _id: id });
  }

  /** Generic per-user emit (e.g. telegram_linked). */
  emitTo(userId: string, event: string, payload: any) {
    this.server.to(room(userId)).emit(event, payload);
  }
}
