#!/usr/bin/env python3
"""
HashScan Agent
Uso: python agent.py --server https://seu-app.vercel.app --speed 1000000
"""
import socket, time, argparse, requests, sys

MULTIPLIER = 50_000_000
BASE       = 0x4000000000000000

def block_to_hex(n: int) -> str:
    return f"0x{(BASE + n * MULTIPLIER):016X}"

def process_block(block: int, speed: int) -> None:
    """Substitua esta função pela sua lógica real de trabalho."""
    start = BASE + block * MULTIPLIER
    end   = start + MULTIPLIER - 1
    print(f"  [WORK] #{block:,}  0x{start:016X} → 0x{end:016X}")
    wait = max(0.5, MULTIPLIER / speed) if speed > 0 else 2.0
    time.sleep(wait)

def run(server: str, speed: int, name: str) -> None:
    url = server.rstrip('/') + '/api/agent'
    print(f"\n  HashScan Agent  |  {name}  |  {speed:,}/s\n")

    # Conectar
    try:
        r = requests.post(url, json={"action": "connect", "agentName": name, "speed": speed}, timeout=10)
        r.raise_for_status()
        block = r.json().get("block")
    except Exception as e:
        print(f"[ERRO] {e}"); sys.exit(1)

    print(f"[OK] Conectado. Primeiro bloco: #{block:,}")

    last_hb = time.time()

    try:
        while block is not None:
            # Heartbeat a cada 5s
            if time.time() - last_hb >= 5:
                try:
                    requests.post(url, json={"action": "heartbeat", "agentName": name, "speed": speed}, timeout=5)
                    last_hb = time.time()
                except: pass

            process_block(block, speed)
            done = block

            # Submeter e pegar próximo
            try:
                r = requests.post(url, json={
                    "action": "submit", "agentName": name,
                    "speed": speed, "completedBlock": done
                }, timeout=10)
                r.raise_for_status()
                block = r.json().get("block")
                if block is not None:
                    print(f"  [NEXT] #{block:,}  {block_to_hex(block)}")
                else:
                    print("[DONE] Sem novos blocos.")
            except Exception as e:
                print(f"[WARN] {e} — tentando em 5s...")
                time.sleep(5)

    except KeyboardInterrupt:
        print("\n[INFO] Encerrando...")
    finally:
        try:
            requests.post(url, json={"action": "disconnect", "agentName": name}, timeout=5)
            print("[OK] Desconectado.")
        except: pass

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--server", required=True)
    p.add_argument("--speed",  type=int, default=500_000)
    p.add_argument("--name",   default=socket.gethostname())
    args = p.parse_args()
    run(args.server, args.speed, args.name)
