"""Trusted collector, run as root ONLY INSIDE a fresh deny-all cloud microVM.
The sample runs as an unprivileged UID with no-new-privileges and a small budget.
Never run this driver or a sample on the API host or the development workspace.
"""
import os, sys, json, hashlib, subprocess, pwd, stat, time, signal, resource, ctypes, socket

ROOT='/tmp/guard-cloud'
INPUT='/tmp/guard-sample-input'
WORK='/tmp/guard-sample-work'
FORBIDDEN=['ABUSECH_AUTH_KEY','MALWAREBAZAAR_AUTH_KEY','MALGUARD_ABUSECH_AUTH_KEY','GUARD_REPORT_SECRET','VERCEL_OIDC_TOKEN','VERCEL_TOKEN','AI_GATEWAY_API_KEY','OPENAI_API_KEY']

def bounded_tree():
    """Bound metadata walking too; empty directories cannot evade the budget."""
    pending=[(WORK,0)];items=[]
    while pending:
        base,depth=pending.pop()
        try:
            with os.scandir(base) as entries:
                for entry in entries:
                    if len(items)>=256:return items,True
                    try:info=entry.stat(follow_symlinks=False)
                    except OSError:continue
                    items.append((entry.path,info))
                    if stat.S_ISDIR(info.st_mode):
                        if depth>=16:return items,True
                        pending.append((entry.path,depth+1))
        except OSError:continue
    return items,False

def run():
    if os.geteuid()!=0 or any(os.environ.get(key) for key in FORBIDDEN):
        raise RuntimeError('collector_prerequisite_failed')
    with open(ROOT+'/job.json') as f: job=json.load(f)
    with open(ROOT+'/sample.bin','rb') as f: data=f.read(1024*1024+1)
    if len(data)>1024*1024 or hashlib.sha256(data).hexdigest()!=job['sha256']:
        raise RuntimeError('sample_identity_mismatch')
    try:
        with socket.create_connection(('1.1.1.1',443),timeout=2):
            raise RuntimeError('network_not_denied')
    except (OSError,TimeoutError): pass
    subprocess.run(['/usr/sbin/useradd','--system','--no-create-home','--shell','/usr/sbin/nologin','guard-sample'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    user=pwd.getpwnam('guard-sample')
    os.makedirs(INPUT,mode=0o755);os.makedirs(WORK,mode=0o700)
    os.chown(WORK,user.pw_uid,user.pw_gid)
    for directory in ['/tmp','/var/tmp','/dev/shm']:
        if os.path.isdir(directory):os.chmod(directory,0o755)
    os.chmod(ROOT,0o700)
    sample=INPUT+('/sample.js' if job['runtime']=='js' else '/sample.bin')
    with open(sample,'wb') as f:f.write(data)
    os.chmod(sample,0o555 if job['runtime']=='elf' else 0o444)
    commands={'js':['node','--max-old-space-size=64',sample], 'python':['python3',sample], 'shell':['/bin/sh',sample], 'elf':[sample]}
    if job['runtime'] not in commands:raise RuntimeError('runtime_unsupported')
    def restrictions():
        os.setsid();os.setgroups([]);os.setgid(user.pw_gid);os.setuid(user.pw_uid)
        if ctypes.CDLL(None,use_errno=True).prctl(38,1,0,0,0)!=0:raise RuntimeError('no_new_privileges_failed')
        resource.setrlimit(resource.RLIMIT_CPU,(8,8));resource.setrlimit(resource.RLIMIT_NPROC,(32,32))
        resource.setrlimit(resource.RLIMIT_NOFILE,(64,64));resource.setrlimit(resource.RLIMIT_FSIZE,(8*1024*1024,8*1024*1024));resource.setrlimit(resource.RLIMIT_CORE,(0,0))
    started=time.monotonic();timed_out=False;budget_exceeded=False
    with open(ROOT+'/sample-output.log','wb') as output:
        process=subprocess.Popen(commands[job['runtime']],cwd=WORK,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':WORK,'TMPDIR':WORK,'LANG':'C.UTF-8'},stdin=subprocess.DEVNULL,stdout=output,stderr=subprocess.STDOUT,preexec_fn=restrictions,close_fds=True)
        while process.poll() is None:
            items,tree_capped=bounded_tree()
            total=sum(info.st_size for _,info in items)
            count=sum(not stat.S_ISDIR(info.st_mode) for _,info in items)
            timed_out=time.monotonic()-started>10
            budget_exceeded=tree_capped or count>128 or total>32*1024*1024 or os.stat(ROOT+'/sample-output.log').st_size>16384
            if timed_out or budget_exceeded:
                try:os.killpg(process.pid,signal.SIGKILL)
                except ProcessLookupError:pass
                break
            time.sleep(0.1)
        process.wait(timeout=2)
    # Kill same-UID descendants, including children that created new sessions.
    subprocess.run(['/usr/bin/pkill','-KILL','-u',str(user.pw_uid)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    created=[];items,tree_capped=bounded_tree();budget_exceeded=budget_exceeded or tree_capped
    for path,metadata in items:
        if not stat.S_ISREG(metadata.st_mode):continue
        try:
            # A FIFO or device swapped into place must never block the collector.
            fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
            with os.fdopen(fd,'rb') as f:
                info=os.fstat(f.fileno())
                if not stat.S_ISREG(info.st_mode):continue
                content=f.read(1024*1024+1)
            created.append({'name':os.path.relpath(path,WORK)[:180],'size':info.st_size,'sha256':hashlib.sha256(content).hexdigest() if len(content)==info.st_size else None})
        except OSError:continue
        if len(created)>=32:break
    with open(ROOT+'/sample-output.log','rb') as f: output=f.read(2048).decode('utf8','replace')
    return {'schema':1,'sampleSha256':job['sha256'],'runtime':job['runtime'],'execution':{'attempted':True,'started':True,'exitCode':process.returncode,'timedOut':timed_out,'budgetExceeded':budget_exceeded,'durationMs':round((time.monotonic()-started)*1000)},'isolation':{'uid':user.pw_uid,'noNewPrivileges':True,'networkProbeDenied':True,'appSecretsAbsent':True},'createdFiles':created,'untrustedOutputExcerpt':output}

try: print(json.dumps(run(),separators=(',',':')))
except Exception as error:
    print(json.dumps({'error':type(error).__name__}),file=sys.stderr)
    sys.exit(1)
