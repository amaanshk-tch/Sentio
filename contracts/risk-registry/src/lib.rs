#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};

#[contracttype]
#[derive(Clone)]
pub struct RiskData {
    pub score: u32,
    pub confidence: u32,
    pub category: Symbol,
    pub last_updated: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct Flag {
    pub reporter: Address,
    pub reason: Symbol,
    pub severity: u32,
    pub timestamp: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Risk(Address),
    RiskHistory(Address),
    Flags(Address),
}

#[contract]
pub struct RiskRegistry;

#[contractimpl]
impl RiskRegistry {
    /// Initializes the contract, binding it to a single Admin authority.
    /// Can only be called once.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Internal helper to retrieve the admin authority.
    fn get_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set")
    }

    /// Sets or updates the risk score for a given address.
    /// Only the registered Admin can invoke this.
    /// Emits a 'risk_updated' event for real-time indexing.
    pub fn set_risk(
        env: Env,
        addr: Address,
        score: u32,
        confidence: u32,
        category: Symbol,
    ) {
        // Enforce explicit access control via stored Admin key
        let admin = Self::get_admin(&env);
        admin.require_auth();

        // Enforce logic bounds
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

        // 1. Overwrite the latest snapshot
        env.storage().instance().set(&DataKey::Risk(addr.clone()), &data);

        // 2. Append to the on-chain history graph
        let mut history: Vec<RiskData> = env
            .storage()
            .instance()
            .get(&DataKey::RiskHistory(addr.clone()))
            .unwrap_or(Vec::new(&env));

        if history.len() >= 50 {
            history.remove(0); // evict oldest
        }
        history.push_back(data.clone());
        env.storage().instance().set(&DataKey::RiskHistory(addr.clone()), &history);

        // 3. Emit blockchain event for DApps/UIs
        env.events().publish((Symbol::new(&env, "risk_updated"), addr.clone()), score);
    }

    /// Retrieves the current risk score data for a given address.
    pub fn get_risk(env: Env, addr: Address) -> Option<RiskData> {
        env.storage().instance().get(&DataKey::Risk(addr))
    }

    /// Retrieves the full risk update history.
    pub fn get_history(env: Env, addr: Address) -> Vec<RiskData> {
        env.storage().instance().get(&DataKey::RiskHistory(addr)).unwrap_or(Vec::new(&env))
    }

    /// Appends a new risk flag (with reporter and severity) to the address's on-chain record.
    pub fn flag(
        env: Env,
        reporter: Address,
        addr: Address,
        reason: Symbol,
        severity: u32,
    ) {
        // Only the backend admin or the reporter can flag? 
        // The user suggested letting Admin restrict flags too, or at least require_auth
        let admin = Self::get_admin(&env);
        admin.require_auth(); // Enforcing admin auth for flags ensures no spam

        let timestamp = env.ledger().timestamp();

        let mut flags: Vec<Flag> = env
            .storage()
            .instance()
            .get(&DataKey::Flags(addr.clone()))
            .unwrap_or(Vec::new(&env));

        if flags.len() >= 50 {
            panic!("Too many flags for this address");
        }

        flags.push_back(Flag {
            reporter,
            reason,
            severity,
            timestamp,
        });

        env.storage().instance().set(&DataKey::Flags(addr.clone()), &flags);

        // Emit a flag event
        env.events().publish((Symbol::new(&env, "risk_flagged"), addr), severity);
    }

    /// Retrieves the list of all flags associated with an address.
    pub fn get_flags(env: Env, addr: Address) -> Vec<Flag> {
        env.storage().instance().get(&DataKey::Flags(addr)).unwrap_or(Vec::new(&env))
    }
}
