#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol, Vec};

const MIN_TTL: u32 = 250_000;
const EXTEND_TTL: u32 = 500_000;

#[contracttype]
#[derive(Clone)]
pub struct RiskData {
    pub score: u32,
    pub confidence: u32,
    pub category: String,
    pub last_updated: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct Flag {
    pub reason: String,
    pub severity: u32,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct RiskRingBuffer {
    pub head: u32,
    pub items: Vec<RiskData>,
}

#[contracttype]
#[derive(Clone)]
pub struct FlagRingBuffer {
    pub head: u32,
    pub items: Vec<Flag>,
}

#[contracttype]
pub enum DataKey {
    Admin,
    PendingAdmin,
    Risk(Address),
    RiskHistory(Address),
    Flags(Address),
}

#[contract]
pub struct RiskRegistry;

#[contractimpl]
impl RiskRegistry {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().extend_ttl(MIN_TTL, EXTEND_TTL);
    }

    fn get_admin(env: &Env) -> Address {
        env.storage().instance().extend_ttl(MIN_TTL, EXTEND_TTL);
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set")
    }

    pub fn propose_admin(env: Env, new_admin: Address) {
        let current_admin = Self::get_admin(&env);
        current_admin.require_auth();
        env.storage().instance().set(&DataKey::PendingAdmin, &new_admin);
        env.storage().instance().extend_ttl(MIN_TTL, EXTEND_TTL);
    }

    pub fn accept_admin(env: Env) {
        let pending: Address = env.storage()
            .instance()
            .get(&DataKey::PendingAdmin)
            .expect("No pending admin");
        pending.require_auth();
        env.storage().instance().set(&DataKey::Admin, &pending);
        env.storage().instance().remove(&DataKey::PendingAdmin);
        env.storage().instance().extend_ttl(MIN_TTL, EXTEND_TTL);
    }

    pub fn set_risk(env: Env, addr: Address, score: u32, confidence: u32, category: String) {
        let admin = Self::get_admin(&env);
        admin.require_auth();

        if score > 100 {
            panic!("Score must be between 0 and 100");
        }
        if confidence > 100 {
            panic!("Confidence must be between 0 and 100");
        }

        let timestamp = env.ledger().timestamp();

        let data = RiskData {
            score,
            confidence,
            category,
            last_updated: timestamp,
        };

        let risk_key = DataKey::Risk(addr.clone());
        env.storage().persistent().set(&risk_key, &data);
        env.storage()
            .persistent()
            .extend_ttl(&risk_key, MIN_TTL, EXTEND_TTL);

        let hist_key = DataKey::RiskHistory(addr.clone());
        let mut rings: RiskRingBuffer =
            env.storage()
                .persistent()
                .get(&hist_key)
                .unwrap_or(RiskRingBuffer {
                    head: 0,
                    items: Vec::new(&env),
                });

        if rings.items.len() < 50 {
            rings.items.push_back(data.clone());
        } else {
            rings.items.set(rings.head, data.clone());
            rings.head = (rings.head + 1) % 50;
        }

        env.storage().persistent().set(&hist_key, &rings);
        env.storage()
            .persistent()
            .extend_ttl(&hist_key, MIN_TTL, EXTEND_TTL);

        env.events()
            .publish((Symbol::new(&env, "risk_updated"), addr.clone()), score);
    }

    pub fn get_risk(env: Env, addr: Address) -> Option<RiskData> {
        let key = DataKey::Risk(addr.clone());
        if env.storage().persistent().has(&key) {
            env.storage()
                .persistent()
                .extend_ttl(&key, MIN_TTL, EXTEND_TTL);
            env.storage().persistent().get(&key)
        } else {
            None
        }
    }

    pub fn get_history(env: Env, addr: Address) -> Vec<RiskData> {
        let key = DataKey::RiskHistory(addr.clone());
        if !env.storage().persistent().has(&key) {
            return Vec::new(&env);
        }
        env.storage()
            .persistent()
            .extend_ttl(&key, MIN_TTL, EXTEND_TTL);
        let rings: RiskRingBuffer = env.storage().persistent().get(&key).unwrap();

        let mut ordered = Vec::new(&env);
        if rings.items.len() < 50 {
            for item in rings.items.iter() {
                ordered.push_back(item);
            }
        } else {
            for i in rings.head..50 {
                ordered.push_back(rings.items.get(i).unwrap());
            }
            for i in 0..rings.head {
                ordered.push_back(rings.items.get(i).unwrap());
            }
        }
        ordered
    }

    pub fn flag(env: Env, addr: Address, reason: String, severity: u32) {
        let admin = Self::get_admin(&env);
        admin.require_auth();

        if severity > 100 {
            panic!("Severity must be between 0 and 100");
        }

        let timestamp = env.ledger().timestamp();
        let flag_key = DataKey::Flags(addr.clone());

        let mut rings: FlagRingBuffer =
            env.storage()
                .persistent()
                .get(&flag_key)
                .unwrap_or(FlagRingBuffer {
                    head: 0,
                    items: Vec::new(&env),
                });

        let new_flag = Flag {
            reason,
            severity,
            timestamp,
        };

        if rings.items.len() < 50 {
            rings.items.push_back(new_flag);
        } else {
            rings.items.set(rings.head, new_flag);
            rings.head = (rings.head + 1) % 50;
        }

        env.storage().persistent().set(&flag_key, &rings);
        env.storage()
            .persistent()
            .extend_ttl(&flag_key, MIN_TTL, EXTEND_TTL);

        env.events()
            .publish((Symbol::new(&env, "risk_flagged"), addr), severity);
    }

    pub fn get_flags(env: Env, addr: Address) -> Vec<Flag> {
        let key = DataKey::Flags(addr.clone());
        if !env.storage().persistent().has(&key) {
            return Vec::new(&env);
        }
        env.storage()
            .persistent()
            .extend_ttl(&key, MIN_TTL, EXTEND_TTL);
        let rings: FlagRingBuffer = env.storage().persistent().get(&key).unwrap();

        let mut ordered = Vec::new(&env);
        if rings.items.len() < 50 {
            for item in rings.items.iter() {
                ordered.push_back(item);
            }
        } else {
            for i in rings.head..50 {
                ordered.push_back(rings.items.get(i).unwrap());
            }
            for i in 0..rings.head {
                ordered.push_back(rings.items.get(i).unwrap());
            }
        }
        ordered
    }

    pub fn clear_flags(env: Env, addr: Address) {
        let admin = Self::get_admin(&env);
        admin.require_auth();
        let key = DataKey::Flags(addr);
        env.storage().persistent().remove(&key);
    }

    pub fn remove_risk(env: Env, addr: Address) {
        let admin = Self::get_admin(&env);
        admin.require_auth();
        env.storage()
            .persistent()
            .remove(&DataKey::Risk(addr.clone()));
        env.storage()
            .persistent()
            .remove(&DataKey::RiskHistory(addr));
    }
}
