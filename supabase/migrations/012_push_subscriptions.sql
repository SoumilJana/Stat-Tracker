create table public.push_subscriptions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    endpoint text not null,
    auth text not null,
    p256dh text not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(endpoint)
);

alter table public.push_subscriptions enable row level security;

-- Users can insert their own push subscriptions
create policy "Users can insert their own push subscriptions"
    on public.push_subscriptions for insert
    with check (auth.uid() = user_id);

-- Users can view their own push subscriptions
create policy "Users can view their own push subscriptions"
    on public.push_subscriptions for select
    using (auth.uid() = user_id);

-- Users can update their own push subscriptions
create policy "Users can update their own push subscriptions"
    on public.push_subscriptions for update
    using (auth.uid() = user_id);

-- Users can delete their own push subscriptions
create policy "Users can delete their own push subscriptions"
    on public.push_subscriptions for delete
    using (auth.uid() = user_id);
