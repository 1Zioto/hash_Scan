#!/usr/bin/env python3
"""
HashScan Agent - Cliente Python para as máquinas trabalhadoras
Uso: python agent.py --server https://seu-app.vercel.app --speed 1000000
"""

import socket
import time
import argparse
import requests
import sys

MULTIPLIER = 50_000_000
RANGE_START = 0x4000000000000000

def get_machine_name() -> str:
    return socket.gethostname()

def block_to_hex(block_index: int) -> str:
    val = RANGE_START + block_index * MULTIPLIER
    return f"0x{val:016X}"

def block_range(block_index: int) -> tuple[str, str]:
    start = RANGE_START + block_index * MULTIPLIER
    end   = start + MULTIPLIER - 1
    return f"0x{start:016X}", f"0x{end:016X}"

def process_block(block_index: int, speed: int) -> None:
    """
    Simula processamento do bloco.
    Substitua este método pela sua lógica real de trabalho.
    O bloco representa o multiplicador: block_index * 50_000_000
    """
    start_hex, end_hex = block_range(block_index)
    print(f"  [WORK] Bloco #{block_index}  {start_hex} → {end_hex}")

    # Simulação: tempo baseado na velocidade declarada
    # Na prática, substitua por sua lógica real aqui
    if speed > 0:
        time.sleep(max(0.5, MULTIPLIER / speed))
    else:
        time.sleep(2.0)

def run(server_url: str, speed: int, agent_name: str) -> None:
    server_url = server_url.rstrip('/')
    endpoint   = f"{server_url}/api/agent"

    print(f"╔══════════════════════════════════════════╗")
    print(f"  HashScan Agent")
    print(f"  Agente : {agent_name}")
    print(f"  Servidor: {server_url}")
    print(f"  Velocidade: {speed:,}/s")
    print(f"╚══════════════════════════════════════════╝\n")

    # Conectar e obter primeiro bloco
    try:
        r = requests.post(endpoint, json={
            "action": "connect",
            "agentName": agent_name,
            "speed": speed,
        }, timeout=10)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"[ERRO] Falha ao conectar: {e}")
        sys.exit(1)

    current_block = data.get("block", -1)
    total_blocks  = data.get("totalBlocks", 0)
    print(f"[OK] Conectado. Total de blocos: {total_blocks}")

    heartbeat_interval = 5  # segundos
    last_heartbeat = time.time()

    try:
        while True:
            if current_block == -1:
                print("[DONE] Todos os blocos foram processados. Encerrando.")
                break

            # Heartbeat em background (simplificado - síncrono aqui)
            now = time.time()
            if now - last_heartbeat >= heartbeat_interval:
                try:
                    requests.post(endpoint, json={
                        "action": "heartbeat",
                        "agentName": agent_name,
                        "speed": speed,
                    }, timeout=5)
                    last_heartbeat = now
                except:
                    pass

            # Processar bloco atual
            process_block(current_block, speed)
            completed_block = current_block

            # Enviar conclusão e pegar próximo bloco
            try:
                r = requests.post(endpoint, json={
                    "action": "submit",
                    "agentName": agent_name,
                    "speed": speed,
                    "completedBlock": completed_block,
                }, timeout=10)
                r.raise_for_status()
                data = r.json()
                current_block = data.get("block", -1)
                print(f"  [NEXT] Próximo bloco: #{current_block}")
            except Exception as e:
                print(f"[WARN] Falha ao enviar bloco: {e}. Tentando novamente em 5s...")
                time.sleep(5)

    except KeyboardInterrupt:
        print("\n[INFO] Encerrando agente...")
    finally:
        try:
            requests.post(endpoint, json={
                "action": "disconnect",
                "agentName": agent_name,
            }, timeout=5)
            print("[OK] Desconectado do servidor.")
        except:
            pass

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HashScan Agent")
    parser.add_argument("--server", required=True, help="URL do servidor (ex: https://seu-app.vercel.app)")
    parser.add_argument("--speed",  type=int, default=500_000, help="Velocidade de processamento (hashes/s)")
    parser.add_argument("--name",   default=None, help="Nome do agente (padrão: nome do PC)")
    args = parser.parse_args()

    agent_name = args.name or get_machine_name()
    run(args.server, args.speed, agent_name)
